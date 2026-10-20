/* What every place looks like when the API sends it out.
 * Used by GET /places, GET /places/:id and GET /search so they always agree:
 *  - closureStatus  'normal' | 'temporary' | 'permanent'
 *  - markedOpen     the admin's saved switch (false = closed until further notice)
 *  - openNow        live: marked open, not closed, and inside today's opening hours (Singapore time)
 *  - rating, reviewCount, crowdLevel   from real reviews only
 *  - intent         how many people plan to go in the next time slot */
const reviewModel = require('../models/review-model');
const intentsController = require('../controllers/intents-controller');

const SG_OFFSET_MS = 8 * 60 * 60 * 1000; // Singapore is UTC+8 all year

function closureStatusOf(place) {
  const hours = (place.hours || '').toLowerCase();
  if (place.closureStatus === 'permanent' || hours.includes('permanent')) return 'permanent';
  if (place.closureStatus === 'temporary' || hours.includes('renovation') || hours.includes('temporar')) return 'temporary';
  return 'normal';
}

// Minutes since midnight in Singapore, e.g. 21:30 -> 1290
function sgMinutesNow(now = new Date()) {
  const sg = new Date(now.getTime() + SG_OFFSET_MS);
  return sg.getUTCHours() * 60 + sg.getUTCMinutes();
}

/* Is the place inside its opening hours ('HH:MM - HH:MM') right now? */
function withinHours(hours, now = new Date()) {
  const match = /^(\d{2}):(\d{2}) - (\d{2}):(\d{2})$/.exec(hours || '');
  if (!match) return false;
  const open = Number(match[1]) * 60 + Number(match[2]);
  const close = Number(match[3]) * 60 + Number(match[4]);
  const minutes = sgMinutesNow(now);
  return minutes >= open && minutes < close;
}

function plain(place) {
  return place.toObject ? place.toObject() : { ...place };
}

/* Turn stored places into what the API sends. One reviews query and one
 * intents query for the whole list, however many places there are. */
async function summarisePlaces(stored, now = new Date()) {
  const list = stored.map(plain);
  const aggs = await reviewModel.aggregateAll();

  for (const place of list) {
    place.closureStatus = closureStatusOf(place);
    place.markedOpen = place.closureStatus === 'normal' && place.openNow !== false;
    place.openNow = place.markedOpen && withinHours(place.hours, now);

    const agg = aggs[place.id] || { rating: 0, reviewCount: 0, crowdLevel: null };
    place.rating = agg.rating;
    place.reviewCount = agg.reviewCount;
    place.crowdLevel = agg.crowdLevel;
  }

  const intents = await intentsController.nextSlotSummary(list);
  for (const place of list) place.intent = intents[place.id] || null;

  return list;
}

module.exports = { summarisePlaces, closureStatusOf, withinHours };
