/* What every place looks like when the API sends it out.
 * Used by GET /places, GET /places/:id and GET /search so they always agree:
 *  - closureStatus  'normal' | 'temporary' | 'permanent'
 *  - markedOpen     the admin's saved switch (false = closed until further notice)
 *  - openNow        live: marked open, not closed, and inside today's opening hours (Singapore time);
 *                   Google-imported places use their exact weekly periods
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

/* Google's weekly periods (day 0 = Sunday). A close on a later day means the
 * place stays open past midnight; a single period with no close means 24/7. */
function withinPeriods(periods, now = new Date()) {
  if (periods.length === 1 && !periods[0].close) return true;
  const sg = new Date(now.getTime() + SG_OFFSET_MS);
  const WEEK = 7 * 24 * 60;
  const minuteOfWeek = sg.getUTCDay() * 24 * 60 + sg.getUTCHours() * 60 + sg.getUTCMinutes();
  const toWeekMinutes = (t) => t.day * 24 * 60 + t.hour * 60 + t.minute;

  return periods.some(p => {
    if (!p.close) return false;
    const open = toWeekMinutes(p.open);
    let close = toWeekMinutes(p.close);
    if (close <= open) close += WEEK; // e.g. Saturday 10pm -> Sunday 2am
    return (minuteOfWeek >= open && minuteOfWeek < close) ||
      (minuteOfWeek + WEEK >= open && minuteOfWeek + WEEK < close);
  });
}

/* Open right now: marked open by an admin, not closed, and inside its hours */
function isOpenNow(place, now = new Date()) {
  if (closureStatusOf(place) !== 'normal' || place.openNow === false) return false;
  return place.openingPeriods?.length
    ? withinPeriods(place.openingPeriods, now)
    : withinHours(place.hours, now);
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
    place.openNow = isOpenNow(place, now);

    const agg = aggs[place.id] || { rating: 0, reviewCount: 0, crowdLevel: null };
    place.rating = agg.rating;
    place.reviewCount = agg.reviewCount;
    place.crowdLevel = agg.crowdLevel;
  }

  const intents = await intentsController.nextSlotSummary(list);
  for (const place of list) place.intent = intents[place.id] || null;

  return list;
}

module.exports = { summarisePlaces, closureStatusOf, isOpenNow, withinHours, withinPeriods };
