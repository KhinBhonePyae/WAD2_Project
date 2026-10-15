/* Time slots for the intent feature.
 * Singapore has no daylight saving, so SG time is always UTC+8.
 * A slot is identified by a date ('YYYY-MM-DD', SG date) and a slot key. */

const SLOTS = [
  { key: 'morning', label: 'Morning', start: 8, end: 12 },
  { key: 'afternoon', label: 'Afternoon', start: 12, end: 17 },
  { key: 'evening', label: 'Evening', start: 17, end: 22 },
];

const SG_OFFSET_MS = 8 * 60 * 60 * 1000;

// 'YYYY-MM-DD' for a Date, in Singapore time
function sgDate(date) {
  return new Date(date.getTime() + SG_OFFSET_MS).toISOString().slice(0, 10);
}

// The real moment (UTC Date) a slot ends, e.g. 2026-10-13 evening -> 22:00 SG
function slotEnd(date, slotKey) {
  const slot = SLOTS.find(s => s.key === slotKey);
  return new Date(Date.parse(`${date}T00:00:00Z`) + slot.end * 3600 * 1000 - SG_OFFSET_MS);
}

// Today's slots that have not ended yet, then all of tomorrow's
function upcomingSlots(now = new Date()) {
  const today = sgDate(now);
  const tomorrow = sgDate(new Date(now.getTime() + 24 * 3600 * 1000));
  const list = [];

  for (const s of SLOTS) {
    if (slotEnd(today, s.key) > now) list.push({ date: today, day: 'Today', slot: s.key, label: s.label });
  }
  for (const s of SLOTS) {
    list.push({ date: tomorrow, day: 'Tomorrow', slot: s.key, label: s.label });
  }
  return list;
}

/* Upcoming slots that overlap a place's opening hours ('HH:MM - HH:MM').
 * A place with no usable hours (e.g. 'Closed for renovation') gets none. */
function slotsForPlace(place, now = new Date()) {
  const match = /^(\d{2}):(\d{2}) - (\d{2}):(\d{2})$/.exec(place.hours || '');
  if (!match) return [];
  const open = Number(match[1]) + Number(match[2]) / 60;
  const close = Number(match[3]) + Number(match[4]) / 60;

  return upcomingSlots(now).filter(s => {
    const slot = SLOTS.find(x => x.key === s.slot);
    return slot.start < close && slot.end > open;
  });
}

function isUpcoming(date, slotKey, place, now = new Date()) {
  return slotsForPlace(place, now).some(s => s.date === date && s.slot === slotKey);
}

/* How packed a place is likely to be: intents as a share of seats.
 * Places without a capacity are treated as 50 seats. */
function packedLevel(count, capacity) {
  if (!count) return null;
  const ratio = count / (Number(capacity) > 0 ? Number(capacity) : 50);
  if (ratio >= 0.6) return 'packed';
  if (ratio >= 0.25) return 'filling';
  return 'quiet';
}

module.exports = { SLOTS, sgDate, slotEnd, upcomingSlots, slotsForPlace, isUpcoming, packedLevel };
