/* Opening-hours logic behind "Open now", the Browse filter and crowd check-ins.
 * All times are Singapore time (UTC+8). Run with: pnpm test */
require('./helpers');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { closureStatusOf, isOpenNow, withinHours, withinPeriods } = require('../utils/place-summary');

// A Date for a Singapore wall-clock time; 2026-10-26 is a Monday
const sg = (day, time) => new Date(`2026-10-${day}T${time}:00+08:00`);
const MON = 26, SAT = 31;

describe('closureStatusOf', () => {
  test('uses the saved status when there is one', () => {
    assert.equal(closureStatusOf({ closureStatus: 'permanent' }), 'permanent');
  });

  test('reads closures from the hours text', () => {
    assert.equal(closureStatusOf({ hours: 'Closed for renovation' }), 'temporary');
    assert.equal(closureStatusOf({ hours: 'Permanently closed' }), 'permanent');
  });

  test('anything else is normal', () => {
    assert.equal(closureStatusOf({ hours: '08:00 - 22:00' }), 'normal');
  });
});

describe('withinHours', () => {
  test('is open between opening and closing time', () => {
    assert.equal(withinHours('08:30 - 22:00', sg(MON, '08:30')), true);
    assert.equal(withinHours('08:30 - 22:00', sg(MON, '21:59')), true);
  });

  test('is closed before opening and from closing time', () => {
    assert.equal(withinHours('08:30 - 22:00', sg(MON, '08:29')), false);
    assert.equal(withinHours('08:30 - 22:00', sg(MON, '22:00')), false);
  });

  test('hours it cannot read count as closed', () => {
    assert.equal(withinHours('Closed for renovation', sg(MON, '12:00')), false);
    assert.equal(withinHours('', sg(MON, '12:00')), false);
  });
});

describe('isOpenNow', () => {
  const library = { hours: '08:30 - 22:00' };

  test('is open inside its hours', () => {
    assert.equal(isOpenNow(library, sg(MON, '12:00')), true);
    assert.equal(isOpenNow(library, sg(MON, '23:00')), false);
  });

  test('is closed whenever an admin marked it closed, even inside its hours', () => {
    assert.equal(isOpenNow({ ...library, openNow: false }, sg(MON, '12:00')), false);
    assert.equal(isOpenNow({ ...library, closureStatus: 'temporary' }, sg(MON, '12:00')), false);
  });

  test("uses Google's weekly hours when the place has them", () => {
    const weekendsOnly = [{ open: { day: 6, hour: 10, minute: 0 }, close: { day: 6, hour: 18, minute: 0 } }];
    assert.equal(isOpenNow({ ...library, openingPeriods: weekendsOnly }, sg(MON, '12:00')), false);
    assert.equal(isOpenNow({ ...library, openingPeriods: weekendsOnly }, sg(SAT, '12:00')), true);
  });
});

describe('withinPeriods (Google weekly hours, day 0 = Sunday)', () => {
  const weekdays = [1, 2, 3, 4, 5].map(day => ({
    open: { day, hour: 9, minute: 0 },
    close: { day, hour: 18, minute: 0 },
  }));

  test('is open inside a period and closed outside it', () => {
    assert.equal(withinPeriods(weekdays, sg(MON, '10:00')), true);
    assert.equal(withinPeriods(weekdays, sg(MON, '18:30')), false);
    assert.equal(withinPeriods(weekdays, sg(SAT, '10:00')), false);
  });

  test('handles a period that runs past midnight', () => {
    const lateSaturday = [{ open: { day: 6, hour: 20, minute: 0 }, close: { day: 0, hour: 2, minute: 0 } }];
    assert.equal(withinPeriods(lateSaturday, sg(SAT, '23:00')), true);
    assert.equal(withinPeriods(lateSaturday, new Date('2026-11-01T01:00:00+08:00')), true);   // Sunday 1am
    assert.equal(withinPeriods(lateSaturday, new Date('2026-11-01T03:00:00+08:00')), false);
  });

  test('a single period with no close means open 24/7', () => {
    assert.equal(withinPeriods([{ open: { day: 0, hour: 0, minute: 0 } }], sg(MON, '03:00')), true);
  });
});
