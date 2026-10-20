const placeModel = require('../models/place-model');
const reviewModel = require('../models/review-model');
const intentModel = require('../models/intent-model');
const intentsController = require('./intents-controller');
const axios = require('axios');
const { withOneMapToken } = require('../utils/onemap-auth');

const ALLOWED_FACILITIES = ['wifi', 'sockets', 'toilets', 'water', 'fnb', 'quiet'];
const ALLOWED_CLOSURE_STATUSES = ['normal', 'temporary', 'permanent'];

async function resolveOneMapLocation(place) {
  const postalCode = place.address?.match(/\b\d{6}\b/)?.[0];
  const searchVal = postalCode || place.address?.replace(/,\s*Singapore\b.*$/i, '').trim() || place.name;
  const { data } = await withOneMapToken(token => axios.get(
    'https://www.onemap.gov.sg/api/common/elastic/search',
    {
      params: {
        searchVal,
        returnGeom: 'Y',
        getAddrDetails: 'Y',
        pageNum: 1
      },
      headers: { Authorization: token },
      timeout: 8000
    }
  ));

  const result = data.results?.find(candidate => {
    const lat = Number(candidate.LATITUDE);
    const lon = Number(candidate.LONGITUDE);
    return Number.isFinite(lat) && Number.isFinite(lon);
  });

  if (!result) {
    const error = new Error('OneMap could not find this address.');
    error.status = 404;
    throw error;
  }

  return {
    lat: Number(result.LATITUDE),
    lon: Number(result.LONGITUDE),
    address: result.ADDRESS || place.address,
    source: 'onemap'
  };
}

function inferClosureStatus(place) {
  const hours = (place.hours || '').toLowerCase();
  if (place.closureStatus === 'permanent' || hours.includes('permanent')) return 'permanent';
  if (place.closureStatus === 'temporary' || hours.includes('renovation') || hours.includes('temporar')) return 'temporary';
  return 'normal';
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function validPhotoSource(photo) {
  if (!photo) return true;
  if (photo.startsWith('/images/')) return true;

  try {
    const url = new URL(photo);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validatePlace(data) {
  const name = data.name?.trim();
  const area = data.area?.trim();
  const address = data.address?.trim();
  const description = data.description?.trim();
  const lat = Number(data.lat);
  const lon = Number(data.lon);

  if (!name) return 'Name is required.';
  if (name.length < 2 || name.length > 100) return 'Name must be between 2 and 100 characters.';
  if (!/[A-Za-z]/.test(name)) return 'Name must contain letters.';

  if (!area) return 'Area is required.';
  if (area.length < 2 || area.length > 80) return 'Area must be between 2 and 80 characters.';
  if (!/[A-Za-z]/.test(area)) return 'Area must contain letters.';

  if (!address) return 'Address is required.';
  if (address.length < 5 || address.length > 200) return 'Address must be between 5 and 200 characters.';
  if (!/[A-Za-z]/.test(address)) return 'Address must contain letters.';

  if (data.lat === null || data.lat === undefined || data.lat === '') return 'Latitude is required.';
  if (!Number.isFinite(lat)) return 'Latitude must be a valid number.';
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';

  if (data.lon === null || data.lon === undefined || data.lon === '') return 'Longitude is required.';
  if (!Number.isFinite(lon)) return 'Longitude must be a valid number.';
  if (lon < -180 || lon > 180) return 'Longitude must be between -180 and 180.';

  const closureStatus = data.closureStatus || 'normal';
  if (!ALLOWED_CLOSURE_STATUSES.includes(closureStatus)) return 'Closure type is invalid.';

  if (closureStatus === 'normal') {
    if (!data.hours) return 'Opening hours are required.';
    if (!/^([01]\d|2[0-3]):[0-5]\d - ([01]\d|2[0-3]):[0-5]\d$/.test(data.hours)) return 'Opening hours must use HH:MM - HH:MM format.';
    const [openTime, closeTime] = data.hours.split(' - ');
    if (timeToMinutes(closeTime) <= timeToMinutes(openTime)) return 'Closing time must be later than opening time.';
  } else if (data.openNow !== false) {
    return 'Temporarily or permanently closed places must be marked closed.';
  }

  if (typeof data.indoor !== 'boolean') return 'Location must be indoor or outdoor.';
  if (typeof data.openNow !== 'boolean') return 'Status must be open or closed.';

  if (!Array.isArray(data.facilities)) return 'Facilities must be an array.';
  if (data.facilities.some(f => !ALLOWED_FACILITIES.includes(f))) return 'One or more facilities are invalid.';

  if (!Array.isArray(data.photos)) return 'Photos must be an array.';
  if (data.photos.length === 0) return 'At least one photo is required.';
  if (data.photos.some(photo => typeof photo !== 'string' || !photo.trim() || !validPhotoSource(photo.trim()))) return 'One or more photo URLs are invalid.';

  if (data.capacity !== undefined && data.capacity !== null && data.capacity !== '') {
    const capacity = Number(data.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) return 'Capacity must be a whole number between 1 and 5000.';
  }

  if (!description) return 'Description is required.';

  return null;
}

/* GET /places - optional ?q= &facilities=wifi,sockets &indoor=true|false &openNow=true */
exports.getPlaces = async (req, res, next) => {
  try {
    let list = await placeModel.retrieveAll();
    list = list.map(p => {
      const place = p.toObject ? p.toObject() : { ...p };
      place.closureStatus = inferClosureStatus(place);
      if (place.closureStatus !== 'normal') place.openNow = false;
      return place;
    });

    const q = (req.query.q || '').trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.area || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    }

    if (req.query.facilities) {
      const want = req.query.facilities.split(',').filter(Boolean);
      list = list.filter(p => want.every(f => (p.facilities || []).includes(f)));
    }

    if (req.query.indoor === 'true') list = list.filter(p => p.indoor === true);
    if (req.query.indoor === 'false') list = list.filter(p => p.indoor === false);
    if (req.query.openNow === 'true') list = list.filter(p => p.openNow === true);

    // attach the live crowd level from the latest review (one query for all places)
    const aggs = await reviewModel.aggregateAll();
    for (const p of list) {
      const agg = aggs[p.id] || { rating: 0, reviewCount: 0, crowdLevel: null };
      p.crowdLevel = agg.crowdLevel;
      if (agg.reviewCount) {
        p.rating = agg.rating;
        p.reviewCount = agg.reviewCount;
      }
    }

    // attach how many people plan to go in the next time slot (one query for all places)
    const intents = await intentsController.nextSlotSummary(list);
    for (const p of list) p.intent = intents[p.id] || null;

    res.json(list);
  } catch (e) {
    next(e);
  }
};

/* GET /places/:id */
exports.getPlace = async (req, res, next) => {
  try {
    const found = await placeModel.findByID(req.params.id);
    if (!found) return res.status(404).json({ error: 'Place not found' });

    const place = found.toObject ? found.toObject() : { ...found };
    place.closureStatus = inferClosureStatus(place);
    if (place.closureStatus !== 'normal') place.openNow = false;
    const agg = await reviewModel.aggregateForPlace(place.id);

    place.crowdLevel = agg.crowdLevel;

    if (agg.reviewCount) {
      place.rating = agg.rating;
      place.reviewCount = agg.reviewCount;
    }

    const intents = await intentsController.nextSlotSummary([place]);
    place.intent = intents[place.id] || null;

    res.json(place);
  } catch (e) {
    next(e);
  }
};

/* GET /places/:id/map-location - resolve the saved address through OneMap */
exports.getMapLocation = async (req, res, next) => {
  try {
    const found = await placeModel.findByID(req.params.id);
    if (!found) return res.status(404).json({ error: 'Place not found' });

    const place = found.toObject ? found.toObject() : { ...found };
    res.json(await resolveOneMapLocation(place));
  } catch (error) {
    console.error('OneMap location lookup failed:', error.message);
    res.status(error.status || 502).json({
      error: error.status === 404 || error.status === 503
        ? error.message
        : 'Could not look up this location with OneMap.'
    });
  }
};

/* POST /places/:id/map-route - get a route from the browser location */
exports.getMapRoute = async (req, res) => {
  try {
    const found = await placeModel.findByID(req.params.id);
    if (!found) return res.status(404).json({ error: 'Place not found' });

    const mode = req.body?.mode || 'walk';
    const allowedModes = ['walk', 'car', 'bus', 'train'];
    if (!allowedModes.includes(mode)) {
      return res.status(400).json({ error: 'Choose walking, car, bus, or train directions.' });
    }

    const startLat = Number(req.body?.lat);
    const startLon = Number(req.body?.lon);
    if (!Number.isFinite(startLat) || !Number.isFinite(startLon)) {
      return res.status(400).json({ error: 'A valid starting location is required.' });
    }
    if (startLat < 1.1 || startLat > 1.5 || startLon < 103.5 || startLon > 104.2) {
      return res.status(400).json({ error: 'Routes are available for locations in Singapore.' });
    }

    const place = found.toObject ? found.toObject() : { ...found };
    const destination = await resolveOneMapLocation(place);
    const isPublicTransport = mode === 'bus' || mode === 'train';
    const routeType = isPublicTransport ? 'pt' : mode === 'car' ? 'drive' : 'walk';
    const requestParams = {
      start: `${startLat},${startLon}`,
      end: `${destination.lat},${destination.lon}`,
      routeType
    };

    if (isPublicTransport) {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Singapore',
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      }).formatToParts(now).reduce((values, part) => {
        values[part.type] = part.value;
        return values;
      }, {});
      requestParams.mode = mode === 'bus' ? 'bus' : 'rail';
      requestParams.date = `${parts.month}-${parts.day}-${parts.year}`;
      requestParams.time = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }).format(now);
      requestParams.maxWalkDistance = 1000;
      requestParams.numItineraries = 3;
    }

    const { data } = await withOneMapToken(token => axios.get(
      'https://www.onemap.gov.sg/api/public/routingsvc/route',
      {
        params: requestParams,
        headers: { Authorization: token },
        timeout: 15000
      }
    ));

    if (isPublicTransport) {
      const itinerary = data.plan?.itineraries?.[0];
      const legs = itinerary?.legs || [];
      const hasRequestedTransport = legs.some(leg => {
        if (mode === 'bus') return leg.mode === 'BUS';
        return ['RAIL', 'SUBWAY', 'TRAM'].includes(leg.mode);
      });
      if (!legs.length || !hasRequestedTransport) {
        return res.status(404).json({
          error: `${mode === 'bus' ? 'Bus' : 'Train'} service has ended for the day. Please try another route.`
        });
      }

      return res.json({
        mode,
        duration: Number(itinerary.duration) || 0,
        distance: legs.reduce((total, leg) => total + (Number(leg.distance) || 0), 0),
        transfers: Number(itinerary.transfers) || 0,
        legs: legs.map(leg => ({
          mode: String(leg.mode || ''),
          route: String(leg.route || ''),
          from: String(leg.from?.name || ''),
          to: String(leg.to?.name || ''),
          duration: Number(leg.duration) || 0,
          distance: Number(leg.distance) || 0,
          geometry: String(leg.legGeometry?.points || '')
        })),
        destination
      });
    }

    if (data.status !== 0 || typeof data.route_geometry !== 'string' || !data.route_geometry) {
      return res.status(404).json({ error: `OneMap could not find a ${mode} route to this place.` });
    }

    const instructions = (data.route_instructions || []).map(step => ({
      action: String(step[0] || 'Continue'),
      road: String(step[1] || ''),
      distance: Number(step[2]) || 0
    }));

    res.json({
      mode,
      geometry: data.route_geometry,
      distance: Number(data.route_summary?.total_distance) || 0,
      duration: Number(data.route_summary?.total_time) || 0,
      instructions,
      destination
    });
  } catch (error) {
    console.error('OneMap route request failed:', error.message);
    if (error.response?.status === 404 && ['bus', 'train'].includes(req.body?.mode)) {
      return res.status(404).json({
        error: `${req.body.mode === 'bus' ? 'Bus' : 'Train'} service has ended for the day. Please try another route.`
      });
    }
    res.status(error.status || 502).json({
      error: error.status === 404 || error.status === 503
        ? error.message
        : 'Could not get directions from OneMap. Please try again.'
    });
  }
};

/* POST /places */
exports.addPlace = async (req, res, next) => {
  try {
    const data = req.body;
    const error = validatePlace(data);

    if (error) return res.status(400).json({ error });

    const closureStatus = data.closureStatus || 'normal';
    const newPlace = await placeModel.createPlace({
      ...data,
      closureStatus,
      openNow: closureStatus === 'normal' ? data.openNow : false,
      hours: closureStatus === 'normal' ? data.hours : '',
      name: data.name.trim(),
      area: data.area.trim(),
      address: data.address.trim(),
      description: data.description.trim(),
      lat: Number(data.lat),
      lon: Number(data.lon),
      capacity: data.capacity ? Number(data.capacity) : null,
      photos: data.photos.map(photo => photo.trim())
    });

    res.status(201).json(newPlace);
  } catch (e) {
    next(e);
  }
};

/* PUT /places/:id */
exports.editPlace = async (req, res, next) => {
  try {
    const data = req.body;
    const error = validatePlace(data);

    if (error) return res.status(400).json({ error });

    const closureStatus = data.closureStatus || 'normal';
    const updated = await placeModel.updatePlace(req.params.id, {
      ...data,
      closureStatus,
      openNow: closureStatus === 'normal' ? data.openNow : false,
      hours: closureStatus === 'normal' ? data.hours : '',
      name: data.name.trim(),
      area: data.area.trim(),
      address: data.address.trim(),
      description: data.description.trim(),
      lat: Number(data.lat),
      lon: Number(data.lon),
      capacity: data.capacity ? Number(data.capacity) : null,
      photos: data.photos.map(photo => photo.trim())
    });

    if (!updated) return res.status(404).json({ error: 'Place not found' });

    res.json(updated);
  } catch (e) {
    next(e);
  }
};

/* DELETE /places/:id */
exports.deletePlace = async (req, res, next) => {
  try {
    const deleted = await placeModel.deletePlace(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Place not found' });

    await intentModel.deleteAllForPlace(deleted.id);

    res.json(deleted);
  } catch (e) {
    next(e);
  }
};