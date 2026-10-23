/* Pulls study spaces near SMU from Google Places API (New) into MongoDB.
 * The live app never calls Google - it reads what this script saved.
 *
 *   node import-google-places.js --dry-run      search only, writes data/google-places-preview.json
 *   node import-google-places.js                import new places, refresh Google data on old ones
 *   node import-google-places.js --force        also redo photos, facilities, tags, description
 *   node import-google-places.js --preview-links   show which existing places would be linked, save nothing
 *
 * Places we already had (NLB libraries, seed places) are LINKED to their Google listing:
 * they get Google's rating, reviews and Maps link, but keep their own name, hours and photos.
 *
 * A plain re-run (e.g. once a month) refreshes Google data and re-downloads photos only when a
 * saved photo link has stopped working.
 *
 * Options: --radius=2000 (metres from SMU)  --min-rating=3.8  --min-reviews=20
 *          --max=120 (places kept)  --photos=2 (per new place)  --no-coworking
 *
 * Quota per run: ~3 pages x QUERIES.length Text Search calls (Enterprise + Atmosphere SKU,
 * because we ask for reviews) plus `--photos` Place Photo calls for each NEW place only. */
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
dotenv.config({ path: path.join(__dirname, 'config.env') });
const axios = require('axios');
const mongoose = require('mongoose');
const { Place } = require('./models/place-model');

const SMU = { lat: 1.2966, lon: 103.8500 }; // Li Ka Shing Library / SMU Green

const QUERIES = [
  { textQuery: 'library', includedType: 'library' },
  { textQuery: 'study cafe' },
  { textQuery: 'cafe with wifi and power sockets' },
  { textQuery: 'coworking space' },
  { textQuery: '24 hour cafe' },
  { textQuery: 'student study area' },
];

// Google's primaryType must be one of these. Searches like "student study area" also return
// colleges, study-abroad agencies and restaurants, which this drops.
const STUDY_TYPES = ['library', 'cafe', 'coffee_shop', 'coffee_stand', 'coffee_roastery', 'tea_house', 'bakery'];
const COWORKING_TYPES = ['coworking_space']; // usually paid day passes; skip with --no-coworking

// Only these are billed at the higher tier because of `places.reviews` - keep the mask tight.
const FIELD_MASK = [
  'id', 'displayName', 'formattedAddress', 'addressComponents', 'location', 'types', 'primaryType',
  'businessStatus', 'rating', 'userRatingCount', 'regularOpeningHours', 'editorialSummary',
  'googleMapsUri', 'websiteUri', 'photos', 'reviews',
  'restroom', 'servesCoffee', 'goodForGroups', 'outdoorSeating',
].map(f => `places.${f}`).concat('nextPageToken').join(',');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

function readArgs() {
  const get = (name, fallback) => {
    const arg = process.argv.find(a => a.startsWith(`--${name}=`));
    return arg ? Number(arg.split('=')[1]) : fallback;
  };
  return {
    dryRun: process.argv.includes('--dry-run'),
    previewLinks: process.argv.includes('--preview-links'),
    coworking: !process.argv.includes('--no-coworking'),
    force: process.argv.includes('--force'),
    radius: get('radius', 2000),
    minRating: get('min-rating', 3.8),
    minReviews: get('min-reviews', 20),
    max: get('max', 120),
    photos: get('photos', 2),
  };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Retry a Google call on errors that tend to clear up by themselves: 403 right after
 * changing a key/billing (settings take a few minutes to reach every server),
 * 429 rate limits and 5xx. Waits 2s, 4s, 8s, 16s between tries. */
async function withRetry(call, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const status = error.response?.status;
      const retryable = status === 403 || status === 429 || status >= 500 || !status;
      if (!retryable || attempt >= tries) throw error;
      const wait = 2000 * 2 ** (attempt - 1);
      console.warn(`  Google returned ${status || error.code}, retrying in ${wait / 1000}s (${attempt}/${tries - 1})`);
      await sleep(wait);
    }
  }
}

function distanceMetres(a, b) {
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Text Search only takes a rectangle as a hard limit, so search the square around the circle
// and drop the corners afterwards with distanceMetres.
function boundingBox(radius) {
  const dLat = radius / 111320;
  const dLon = radius / (111320 * Math.cos(SMU.lat * Math.PI / 180));
  return {
    rectangle: {
      low: { latitude: SMU.lat - dLat, longitude: SMU.lon - dLon },
      high: { latitude: SMU.lat + dLat, longitude: SMU.lon + dLon },
    },
  };
}

async function searchAll(query, radius) {
  const results = [];
  let pageToken;
  for (let page = 0; page < 3; page++) { // Text Search stops at 60 results anyway
    const { data } = await withRetry(() => axios.post('https://places.googleapis.com/v1/places:searchText', {
      ...query,
      strictTypeFiltering: !!query.includedType,
      pageSize: 20,
      pageToken,
      regionCode: 'SG',
      locationRestriction: boundingBox(radius),
    }, {
      headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': FIELD_MASK },
      timeout: 15000,
    }));
    results.push(...(data.places || []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await sleep(1500); // the next page token can take a moment to become valid
  }
  return results;
}

/* ---------- mapping a Google place onto our schema ---------- */

// First two digits of a Singapore postcode -> general area (URA postal districts)
const POSTAL_AREAS = [
  [['01', '02', '03', '04', '05', '06'], 'Raffles Place'], [['07', '08'], 'Tanjong Pagar'],
  [['09', '10'], 'Telok Blangah'], [['11', '12', '13'], 'Pasir Panjang'], [['14', '15', '16'], 'Tiong Bahru'],
  [['17'], 'City Hall'], [['18', '19'], 'Bugis'], [['20', '21'], 'Little India'],
  [['22', '23'], 'Orchard'], [['24', '25', '26', '27'], 'Tanglin'], [['28', '29', '30'], 'Novena'],
  [['31', '32', '33'], 'Balestier'], [['34', '35', '36', '37'], 'Macpherson'], [['38', '39', '40', '41'], 'Geylang'],
  [['42', '43', '44', '45'], 'Katong'], [['46', '47', '48'], 'Bedok'], [['49', '50', '81'], 'Changi'],
  [['51', '52'], 'Tampines'], [['53', '54', '55', '82'], 'Hougang'], [['56', '57'], 'Bishan'],
  [['58', '59'], 'Bukit Timah'], [['60', '61', '62', '63', '64'], 'Jurong'], [['65', '66', '67', '68'], 'Bukit Panjang'],
  [['69', '70', '71'], 'Tengah'], [['72', '73'], 'Kranji'], [['75', '76'], 'Yishun'], [['77', '78'], 'Upper Thomson'],
  [['79', '80'], 'Seletar'],
];

function areaOf(gp) {
  const postal = (gp.addressComponents || []).find(c => c.types?.includes('postal_code'))?.longText || '';
  const match = POSTAL_AREAS.find(([sectors]) => sectors.includes(postal.slice(0, 2)));
  return match ? match[1] : 'Central';
}

const pad = (n) => String(n).padStart(2, '0');

/* Our `hours` field is one 'HH:MM - HH:MM' range (the admin form and intent slots use it),
 * so take the most common daily range. Past-midnight closes are capped at 23:59; the exact
 * weekly hours live in openingPeriods and are what openNow actually checks. */
function summaryHours(periods) {
  if (!periods.length) return '';
  if (periods.length === 1 && !periods[0].close) return '00:00 - 23:59'; // open 24/7
  const counts = {};
  for (const p of periods) {
    if (!p.close) continue;
    const open = `${pad(p.open.hour)}:${pad(p.open.minute)}`;
    const nextDay = p.close.day !== p.open.day;
    const close = nextDay ? '23:59' : `${pad(p.close.hour)}:${pad(p.close.minute)}`;
    const range = `${open} - ${close}`;
    counts[range] = (counts[range] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

const mentions = (text, re) => (text.match(re) || []).length;

function facilitiesOf(gp) {
  const types = gp.types || [];
  const reviewText = (gp.reviews || []).map(r => r.text?.text || '').join(' ').toLowerCase();
  const facilities = new Set();

  if (types.includes('library')) ['wifi', 'toilets', 'water', 'quiet'].forEach(f => facilities.add(f));
  if (gp.restroom) facilities.add('toilets');
  if (gp.servesCoffee || types.some(t => ['cafe', 'coffee_shop', 'restaurant', 'bakery', 'food'].includes(t))) facilities.add('fnb');

  // Google has no wifi/socket fields, so read the (up to 5) reviews for them
  if (mentions(reviewText, /wi-?fi|internet/g)) facilities.add('wifi');
  if (mentions(reviewText, /socket|power point|plug|outlet|charging/g)) facilities.add('sockets');
  if (mentions(reviewText, /quiet|peaceful|calm|silent/g) > mentions(reviewText, /noisy|loud|crowded|packed/g)) facilities.add('quiet');

  return [...facilities];
}

function tagsOf(gp, facilities) {
  const tags = [];
  if (facilities.includes('quiet') || (gp.types || []).includes('library')) tags.push('Individual study');
  if (gp.goodForGroups || gp.primaryType === 'coworking_space') tags.push('Group study');
  if (facilities.includes('quiet')) tags.push('Quiet');
  if (gp.outdoorSeating) tags.push('Outdoor');
  return tags;
}

function entryOf(gp) {
  if (gp.primaryType === 'library') return 'free';
  if (gp.primaryType === 'coworking_space') return 'pass';
  return 'purchase'; // cafes: buy a drink to sit
}

function capacityOf(gp) {
  const types = gp.types || [];
  if (types.includes('library')) return 200;
  if (types.includes('coworking_space')) return 80;
  return 40;
}

const CLOSURE = { OPERATIONAL: 'normal', CLOSED_TEMPORARILY: 'temporary', CLOSED_PERMANENTLY: 'permanent' };

// Fields that come straight from Google and are safe to refresh on every run
function googleFields(gp) {
  const periods = gp.regularOpeningHours?.periods || [];
  const closureStatus = CLOSURE[gp.businessStatus] || 'normal';
  return {
    googlePlaceId: gp.id,
    placeType: gp.primaryType || '',
    name: gp.displayName?.text,
    address: gp.formattedAddress || '',
    lat: gp.location.latitude,
    lon: gp.location.longitude,
    closureStatus,
    openNow: closureStatus === 'normal',
    hours: closureStatus === 'normal' ? summaryHours(periods) : '',
    openingPeriods: periods,
    weekdayHours: gp.regularOpeningHours?.weekdayDescriptions || [],
    googleRating: gp.rating ?? null,
    googleRatingCount: gp.userRatingCount || 0,
    googleReviews: (gp.reviews || []).map(r => ({
      author: r.authorAttribution?.displayName || 'Google user',
      authorUri: r.authorAttribution?.uri || '',
      authorPhoto: r.authorAttribution?.photoUri || '',
      rating: r.rating,
      text: r.text?.text || '',
      relativeTime: r.relativePublishTimeDescription || '',
      publishTime: r.publishTime ? new Date(r.publishTime) : null,
    })),
    googleMapsUri: gp.googleMapsUri || '',
    website: gp.websiteUri || '',
    googleSyncedAt: new Date(),
  };
}

// For a place we already had (NLB library, seed place): add Google's rating, reviews
// and links, but keep its own name, hours, photos and description.
function linkFields(gp) {
  const g = googleFields(gp);
  return {
    googlePlaceId: g.googlePlaceId,
    googleLinked: true,
    googleRating: g.googleRating,
    googleRatingCount: g.googleRatingCount,
    googleReviews: g.googleReviews,
    googleMapsUri: g.googleMapsUri,
    website: g.website,
    googleSyncedAt: g.googleSyncedAt,
  };
}

// Fields we only fill in once, so admin edits are not overwritten on the next run (unless --force)
function initialFields(gp) {
  const facilities = facilitiesOf(gp);
  return {
    area: areaOf(gp),
    indoor: true,
    facilities,
    tags: tagsOf(gp, facilities),
    capacity: capacityOf(gp),
    entry: entryOf(gp),
    description: gp.editorialSummary?.text || `${gp.displayName?.text} in ${areaOf(gp)}, ${(distanceMetres(SMU, { lat: gp.location.latitude, lon: gp.location.longitude }) / 1000).toFixed(1)} km from SMU.`,
  };
}

/* Resolve photo names to real image URLs (one Place Photo call each). */
async function photosOf(gp, count) {
  const photos = [];
  const photoAttributions = [];
  for (const photo of (gp.photos || []).slice(0, count)) {
    try {
      const { data } = await withRetry(() => axios.get(`https://places.googleapis.com/v1/${photo.name}/media`, {
        params: { maxWidthPx: 1200, skipHttpRedirect: true, key: API_KEY },
        timeout: 15000,
      }));
      photos.push(data.photoUri);
      photoAttributions.push(photo.authorAttributions?.[0]?.displayName || 'Google Maps user');
    } catch (error) {
      console.warn(`  photo skipped for ${gp.displayName?.text}: ${error.response?.status || error.message}`);
    }
  }
  return { photos, photoAttributions };
}

/* Google photo links can stop working after a while. Fetch one byte of each saved
 * Google-hosted photo; if any fail, the caller downloads fresh ones. Free - no API call. */
async function photosBroken(urls = []) {
  const google = urls.filter(u => /googleusercontent\.com|googleapis\.com/.test(u));
  for (const url of google) {
    try {
      await axios.get(url, { headers: { Range: 'bytes=0-0' }, responseType: 'arraybuffer', timeout: 10000 });
    } catch {
      return true;
    }
  }
  return false;
}

/* ---------- filtering ---------- */

function isStudySpot(gp, opts) {
  const isLibrary = gp.primaryType === 'library';
  if (!gp.location || !gp.displayName?.text) return false;
  if (gp.businessStatus && gp.businessStatus !== 'OPERATIONAL') return false;
  const allowed = opts.coworking ? STUDY_TYPES.concat(COWORKING_TYPES) : STUDY_TYPES;
  if (!allowed.includes(gp.primaryType)) return false;
  if (distanceMetres(SMU, { lat: gp.location.latitude, lon: gp.location.longitude }) > opts.radius) return false;
  if (!gp.regularOpeningHours?.periods?.length) return false; // no hours = no "open now"
  // Small libraries (e.g. SMU's law library) have few ratings but are still great;
  // under 10 ratings is usually a court or college library the public can't use.
  if (isLibrary) return (gp.userRatingCount || 0) >= 10;
  return (gp.rating || 0) >= opts.minRating && (gp.userRatingCount || 0) >= opts.minReviews;
}

const placeWords = (s) => new Set((s || '').toLowerCase().split(/\W+/).filter(w => w.length > 3));
const NOT_A_SPOT = ['shopping_mall', 'plaza', 'department_store']; // "Funan" the mall is not "Funan Study Terrace"

const GENERIC_WORDS = ['library', 'public', 'reference', 'cafe', 'coffee'];

/* How well does Google place `gp` match our place `p`? 0 = not the same spot.
 * Must be close together, then (best first): same main words > one name's words all in
 * the other ("SMU Connexion" / "SMU Connexion Pods") > two libraries sharing a distinctive
 * word ("Li Ka Shing Library" / "SMU Li Ka Shing Library"). Never "library" alone, because
 * the National, Central and Central Arts libraries share one building. Extra words cost a
 * little, so "Orchard Library" prefers "library@orchard" over an exhibition held there. */
function matchScore(gp, p, maxMetres) {
  if (!Number.isFinite(p.lat) || !gp.location) return 0;
  if (distanceMetres({ lat: gp.location.latitude, lon: gp.location.longitude }, { lat: p.lat, lon: p.lon }) > maxMetres) return 0;
  if (NOT_A_SPOT.includes(gp.primaryType)) return 0;
  const ours = placeWords(p.name);
  const theirs = placeWords(gp.displayName?.text);
  if (!ours.size || !theirs.size) return 0;

  const shared = [...ours].filter(w => theirs.has(w));
  const extra = ours.size + theirs.size - 2 * shared.length;
  let tier = 0;
  if (shared.length === ours.size && shared.length === theirs.size) tier = 3;
  else if (shared.length === ours.size || shared.length === theirs.size) tier = 2;
  else if (gp.primaryType === 'library' && /librar/i.test(p.name) && shared.some(w => !GENERIC_WORDS.includes(w))) tier = 1;
  return tier ? tier * 100 - extra : 0;
}

function bestBy(list, score) {
  let best = null, bestScore = 0;
  for (const item of list) {
    const value = score(item);
    if (value > bestScore) { best = item; bestScore = value; }
  }
  return best;
}

// A search result in the same building as a place we already have (e.g. an NLB library)?
function duplicateOf(gp, existing) {
  return bestBy(existing.filter(p => !p.googlePlaceId), p => matchScore(gp, p, 60));
}

/* Look up one of our own places on Google by name, near its coordinates. */
async function findOnGoogle(place) {
  const { data } = await withRetry(() => axios.post('https://places.googleapis.com/v1/places:searchText', {
    textQuery: place.name,
    pageSize: 5,
    regionCode: 'SG',
    locationBias: { circle: { center: { latitude: place.lat, longitude: place.lon }, radius: 300 } },
  }, {
    headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': FIELD_MASK },
    timeout: 15000,
  }));
  return bestBy(data.places || [], gp => matchScore(gp, place, 150));
}

const DETAILS_MASK = FIELD_MASK.split(',').filter(f => f.startsWith('places.')).map(f => f.slice(7)).join(',');

/* Fresh data for one saved place that this run's searches did not return. */
async function placeDetails(googlePlaceId) {
  const { data } = await withRetry(() => axios.get(`https://places.googleapis.com/v1/places/${googlePlaceId}`, {
    headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': DETAILS_MASK },
    timeout: 15000,
  }));
  return data;
}

/* ---------- main ---------- */

async function importGooglePlaces() {
  const opts = readArgs();
  if (!API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY is missing from server/config.env');
    process.exitCode = 1;
    return;
  }

  try {
    const found = new Map();
    for (const query of QUERIES) {
      const results = await searchAll(query, opts.radius);
      results.forEach(gp => found.set(gp.id, gp));
      console.log(`"${query.textQuery}": ${results.length} results (${found.size} unique so far)`);
    }

    const keep = [...found.values()]
      .filter(gp => isStudySpot(gp, opts))
      // libraries first so --max never cuts them, then the most-reviewed
      .sort((a, b) => (b.primaryType === 'library') - (a.primaryType === 'library') ||
        (b.userRatingCount || 0) - (a.userRatingCount || 0))
      .slice(0, opts.max);
    console.log(`${keep.length} pass the filters (radius ${opts.radius}m, rating >= ${opts.minRating}, >= ${opts.minReviews} ratings).`);

    if (opts.dryRun) {
      const preview = keep.map(gp => ({ ...googleFields(gp), ...initialFields(gp) }));
      const out = path.join(__dirname, 'data', 'google-places-preview.json');
      fs.writeFileSync(out, JSON.stringify(preview, null, 2));
      console.log(`Dry run - nothing saved to MongoDB. Preview written to ${out}`);
      return;
    }

    if (!process.env.DB) throw new Error('No DB string in config.env - use --dry-run to preview without MongoDB.');
    await mongoose.connect(process.env.DB, { serverSelectionTimeoutMS: 5000 });

    // Libraries imported before `entry` existed are free to use
    await Place.updateMany(
      { entry: { $in: ['', null] }, $or: [{ branchCode: { $exists: true } }, { name: /librar/i }] },
      { $set: { entry: 'free' } }
    );

    const fields = { id: 1, name: 1, lat: 1, lon: 1, googlePlaceId: 1, googleLinked: 1, googleLookupFailedAt: 1, photos: 1 };
    const existing = await Place.find({}, fields).lean();
    const last = await Place.findOne().sort({ id: -1 });
    let maxId = last ? last.id : 0;
    let created = 0, refreshed = 0, linked = 0, photosRenewed = 0;
    const seen = new Set(); // our ids updated in this run

    // 1. Search results: new places, refreshes, and links to places we already had
    for (const gp of keep) {
      let mine = existing.find(p => p.googlePlaceId === gp.id);
      if (!mine) {
        const dup = duplicateOf(gp, existing);
        if (dup) {
          if (opts.previewLinks) console.log(`  link  ${dup.name}  ->  ${gp.displayName.text} (${gp.rating ?? '-'}★, ${gp.userRatingCount || 0} ratings)`);
          mine = dup; dup.googlePlaceId = gp.id; dup.googleLinked = true; linked++;
        }
      }
      if (mine?.googleLinked) {
        if (!opts.previewLinks) await Place.updateOne({ id: mine.id }, { $set: linkFields(gp) });
        seen.add(mine.id);
        continue;
      }
      if (opts.previewLinks) continue;

      const update = googleFields(gp);
      if (!mine || opts.force) Object.assign(update, initialFields(gp));
      if (!mine || opts.force || !mine.photos?.length || await photosBroken(mine.photos)) {
        Object.assign(update, await photosOf(gp, opts.photos));
        if (mine) photosRenewed++;
      }

      const id = mine ? mine.id : ++maxId;
      // $set leaves our own rating/reviewCount alone
      await Place.updateOne({ id }, { $set: { ...update, id } }, { upsert: true });
      seen.add(id);
      mine ? refreshed++ : created++;
    }

    // 2. Our places with no Google listing yet (NLB libraries all over Singapore, seed places):
    //    look each one up once. A failed lookup is not retried unless --force.
    const unlinked = existing.filter(p => !p.googlePlaceId && (opts.force || !p.googleLookupFailedAt));
    for (const place of unlinked) {
      const gp = await findOnGoogle(place);
      if (opts.previewLinks) {
        console.log(gp ? `  link  ${place.name}  ->  ${gp.displayName.text} (${gp.rating ?? '-'}★, ${gp.userRatingCount || 0} ratings)` : `  none  ${place.name}`);
        continue;
      }
      if (gp && !existing.some(p => p.googlePlaceId === gp.id)) {
        await Place.updateOne({ id: place.id }, { $set: linkFields(gp), $unset: { googleLookupFailedAt: 1 } });
        place.googlePlaceId = gp.id;
        seen.add(place.id);
        linked++;
      } else {
        await Place.updateOne({ id: place.id }, { $set: { googleLookupFailedAt: new Date() } });
      }
    }

    if (opts.previewLinks) {
      console.log('Preview only - nothing saved.');
      return;
    }

    // 3. Saved places this run's searches did not return still get fresh ratings, reviews and hours
    let detailed = 0;
    for (const place of existing.filter(p => p.googlePlaceId && !seen.has(p.id))) {
      try {
        const gp = await placeDetails(place.googlePlaceId);
        await Place.updateOne({ id: place.id }, { $set: place.googleLinked ? linkFields(gp) : googleFields(gp) });
        detailed++;
      } catch (error) {
        console.warn(`  could not refresh ${place.name}: ${error.response?.status || error.message}`);
      }
    }

    console.log(`Done: ${created} new, ${refreshed} refreshed (${photosRenewed} with new photos), ` +
      `${linked} existing places linked to Google, ${detailed} refreshed individually.`);
  } catch (error) {
    const status = error.response?.status;
    console.error('Import failed:', status, error.response?.data?.error?.message || error.message);
    if (status === 403) console.error('Check that "Places API (New)" is enabled for this key in Google Cloud Console.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

importGooglePlaces();
