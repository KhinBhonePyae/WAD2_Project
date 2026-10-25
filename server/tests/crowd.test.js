/* Crowd reports: one-tap check-ins (POST/DELETE /crowd/:placeId) and the
 * combined report list (GET /crowd/place/:placeId). Run with: pnpm test */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { call } = require('./helpers');
const crowd = require('../controllers/crowd-controller');
const checkinModel = require('../models/checkin-model');
const reviewModel = require('../models/review-model');
const placeModel = require('../models/place-model');

// Mock data: place 1 has two reviews (newest moderate, older quiet); place 3 has none.
// Each test uses its own user id so the tests don't affect each other.
let n = 0;
const newUser = () => 'test-user-' + (++n);
const NO_REVIEWS = 3;
const ALWAYS_OPEN = [{ open: { day: 0, hour: 0, minute: 0 } }];   // Google's way of saying 24/7

// Check-ins only work while a place is open, so make the test places open 24/7;
// otherwise these tests would pass or fail depending on the time of day.
before(async () => {
  for (const id of [1, NO_REVIEWS]) (await placeModel.findByID(id)).openingPeriods = ALWAYS_OPEN;
});

describe('GET /crowd/place/:placeId', () => {
  test('a bad place id is a 404', async () => {
    const res = await call(crowd.getPlaceCrowd, { params: { placeId: 'abc' } });
    assert.equal(res.statusCode, 404);
  });

  test('counts the crowd level from reviews as reports', async () => {
    const res = await call(crowd.getPlaceCrowd, { params: { placeId: '1' } });
    assert.equal(res.body.total, 2);
    assert.deepEqual(res.body.counts, { quiet: 1, moderate: 1, packed: 0 });
    assert.equal(res.body.latest.source, 'review');
  });

  test('a place with no reports gets an empty but complete answer', async () => {
    const res = await call(crowd.getPlaceCrowd, { params: { placeId: '5' } });
    assert.equal(res.body.total, 0);
    assert.equal(res.body.latest, null);
    assert.deepEqual(res.body.counts, { quiet: 0, moderate: 0, packed: 0 });
  });

  test('check-ins and reviews are combined, newest first', async () => {
    const user = newUser();
    await call(crowd.checkIn, { params: { placeId: '1' }, body: { level: 'packed' }, userId: user });

    const res = await call(crowd.getPlaceCrowd, { params: { placeId: '1' } });
    assert.equal(res.body.total, 3);
    assert.equal(res.body.counts.packed, 1);
    assert.equal(res.body.latest.level, 'packed');
    assert.equal(res.body.latest.source, 'check-in');

    await checkinModel.deleteAllForUser(user);
  });
});

describe('POST /crowd/:placeId (check in)', () => {
  test('rejects a crowd level that is not quiet, moderate or packed', async () => {
    const res = await call(crowd.checkIn, { params: { placeId: '1' }, body: { level: 'empty' }, userId: newUser() });
    assert.equal(res.statusCode, 400);
  });

  test('rejects a place that does not exist', async () => {
    const res = await call(crowd.checkIn, { params: { placeId: '99999' }, body: { level: 'quiet' }, userId: newUser() });
    assert.equal(res.statusCode, 404);
  });

  test('rejects a place that is closed for renovation', async () => {
    const closed = await placeModel.createPlace({ name: 'Test closed place', hours: 'Closed for renovation' });
    const res = await call(crowd.checkIn, { params: { placeId: String(closed.id) }, body: { level: 'quiet' }, userId: newUser() });
    assert.equal(res.statusCode, 400);
    await placeModel.deletePlace(closed.id);
  });

  test('rejects a place that is not open right now', async () => {
    const shut = await placeModel.createPlace({ name: 'Test shut place', hours: '08:00 - 20:00', openNow: false });
    const res = await call(crowd.checkIn, { params: { placeId: String(shut.id) }, body: { level: 'packed' }, userId: newUser() });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /not open right now/);
    await placeModel.deletePlace(shut.id);
  });

  test('saves a report and returns 201', async () => {
    const user = newUser();
    const res = await call(crowd.checkIn, { params: { placeId: String(NO_REVIEWS) }, body: { level: 'quiet' }, userId: user });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.level, 'quiet');
    await checkinModel.deleteAllForUser(user);
  });

  test('a second tap within the hour changes the report instead of adding one', async () => {
    const user = newUser();
    const params = { placeId: String(NO_REVIEWS) };
    await call(crowd.checkIn, { params, body: { level: 'quiet' }, userId: user });
    await call(crowd.checkIn, { params, body: { level: 'packed' }, userId: user });

    const mine = (await checkinModel.findByPlace(NO_REVIEWS)).filter(c => c.userId === user);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].level, 'packed');
    await checkinModel.deleteAllForUser(user);
  });

  test('after an hour, a new tap adds a new report', async () => {
    const user = newUser();
    const params = { placeId: String(NO_REVIEWS) };
    await call(crowd.checkIn, { params, body: { level: 'quiet' }, userId: user });
    const [first] = (await checkinModel.findByPlace(NO_REVIEWS)).filter(c => c.userId === user);
    first.createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);   // pretend it was 2 hours ago

    await call(crowd.checkIn, { params, body: { level: 'moderate' }, userId: user });
    const mine = (await checkinModel.findByPlace(NO_REVIEWS)).filter(c => c.userId === user);
    assert.equal(mine.length, 2);
    await checkinModel.deleteAllForUser(user);
  });
});

describe('GET /crowd/mine/:placeId and DELETE /crowd/:placeId (undo)', () => {
  test('shows the user their own recent report, or null when there is none', async () => {
    const user = newUser();
    const params = { placeId: String(NO_REVIEWS) };
    assert.equal((await call(crowd.getMyCheckin, { params, userId: user })).body.level, null);

    await call(crowd.checkIn, { params, body: { level: 'moderate' }, userId: user });
    assert.equal((await call(crowd.getMyCheckin, { params, userId: user })).body.level, 'moderate');
    await checkinModel.deleteAllForUser(user);
  });

  test('undo removes the report, and a second undo is a 404', async () => {
    const user = newUser();
    const params = { placeId: String(NO_REVIEWS) };
    await call(crowd.checkIn, { params, body: { level: 'packed' }, userId: user });

    assert.equal((await call(crowd.undoCheckin, { params, userId: user })).statusCode, 200);
    assert.equal((await call(crowd.getMyCheckin, { params, userId: user })).body.level, null);
    assert.equal((await call(crowd.undoCheckin, { params, userId: user })).statusCode, 404);
  });

  test('a place id that is not a number is a 404, not a server error', async () => {
    const params = { placeId: 'abc' };
    assert.equal((await call(crowd.getMyCheckin, { params, userId: newUser() })).statusCode, 404);
    assert.equal((await call(crowd.undoCheckin, { params, userId: newUser() })).statusCode, 404);
    assert.equal((await call(crowd.checkIn, { params, body: { level: 'quiet' }, userId: newUser() })).statusCode, 404);
  });

  test("a user cannot undo someone else's report", async () => {
    const owner = newUser();
    const params = { placeId: String(NO_REVIEWS) };
    await call(crowd.checkIn, { params, body: { level: 'quiet' }, userId: owner });

    assert.equal((await call(crowd.undoCheckin, { params, userId: newUser() })).statusCode, 404);
    assert.equal((await call(crowd.getMyCheckin, { params, userId: owner })).body.level, 'quiet');
    await checkinModel.deleteAllForUser(owner);
  });
});

describe('place crowd level (shown on cards and the place header)', () => {
  test('a check-in newer than the latest review becomes the place crowd level', async () => {
    assert.equal((await reviewModel.aggregateForPlace(1)).crowdLevel, 'moderate');   // newest mock review

    const user = newUser();
    await call(crowd.checkIn, { params: { placeId: '1' }, body: { level: 'packed' }, userId: user });
    assert.equal((await reviewModel.aggregateForPlace(1)).crowdLevel, 'packed');
    assert.equal((await reviewModel.aggregateAll())[1].crowdLevel, 'packed');

    // undo puts it back to what the reviews say
    await call(crowd.undoCheckin, { params: { placeId: '1' }, userId: user });
    assert.equal((await reviewModel.aggregateForPlace(1)).crowdLevel, 'moderate');
  });

  test('a place with check-ins but no reviews gets a crowd level but no rating', async () => {
    const user = newUser();
    await call(crowd.checkIn, { params: { placeId: String(NO_REVIEWS) }, body: { level: 'quiet' }, userId: user });

    const agg = (await reviewModel.aggregateAll())[NO_REVIEWS];
    assert.deepEqual(agg, { rating: 0, reviewCount: 0, crowdLevel: 'quiet' });
    await checkinModel.deleteAllForUser(user);
  });

  test("deleting a user's check-ins removes only theirs", async () => {
    const [a, b] = [newUser(), newUser()];
    const params = { placeId: String(NO_REVIEWS) };
    await call(crowd.checkIn, { params, body: { level: 'quiet' }, userId: a });
    await call(crowd.checkIn, { params, body: { level: 'packed' }, userId: b });

    await checkinModel.deleteAllForUser(a);
    const left = (await checkinModel.findByPlace(NO_REVIEWS)).map(c => c.userId);
    assert.ok(!left.includes(a));
    assert.ok(left.includes(b));
    await checkinModel.deleteAllForUser(b);
  });
});
