/* Crowd check-in model: a one-tap "how busy is it right now?" report.
 * Separate from reviews so people can report the crowd without writing a review.
 * A user who reports the same place again within CHANGE_WINDOW_MS updates their
 * last report instead of adding another, so one person can't flood a place. */
const mongoose = require('mongoose');

const CHANGE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const checkinSchema = new mongoose.Schema({
  placeId: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  level: { type: String, required: true, enum: ['quiet', 'moderate', 'packed'] },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

checkinSchema.index({ placeId: 1, createdAt: -1 });

const Checkin = mongoose.model('Checkin', checkinSchema, 'checkins');

// --- mock-mode store --------------------------------------------------
let mem = [];

function newestFirst(list) {
  return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

exports.findByPlace = async (placeId) => {
  if (global.MOCK_MODE) return newestFirst(mem.filter(c => c.placeId === Number(placeId)));
  return Checkin.find({ placeId: Number(placeId) }).sort({ createdAt: -1 });
};

function windowStart() {
  return new Date(Date.now() - CHANGE_WINDOW_MS);
}

/* The user's own check-in from the last hour (the one they can still change or undo) */
exports.findRecent = async (userId, placeId) => {
  if (global.MOCK_MODE) {
    return mem.find(c => c.userId === String(userId) && c.placeId === Number(placeId) && c.createdAt > windowStart()) || null;
  }
  return Checkin.findOne({ userId, placeId: Number(placeId), createdAt: { $gt: windowStart() } }).sort({ createdAt: -1 });
};

/* Undo: remove the user's check-in from the last hour */
exports.removeRecent = async (userId, placeId) => {
  if (global.MOCK_MODE) {
    const recent = await exports.findRecent(userId, placeId);
    if (!recent) return null;
    mem = mem.filter(c => c !== recent);
    return recent;
  }
  return Checkin.findOneAndDelete(
    { userId, placeId: Number(placeId), createdAt: { $gt: windowStart() } },
    { sort: { createdAt: -1 } }
  );
};

/* Add a check-in, or change the user's own one from the last hour */
exports.report = async (userId, placeId, level) => {
  const since = windowStart();

  if (global.MOCK_MODE) {
    const recent = mem.find(c => c.userId === String(userId) && c.placeId === Number(placeId) && c.createdAt > since);
    if (recent) { Object.assign(recent, { level, createdAt: new Date() }); return recent; }
    const doc = { _id: 'c' + Date.now() + Math.random(), userId: String(userId), placeId: Number(placeId), level, createdAt: new Date() };
    mem.push(doc);
    return doc;
  }

  const recent = await Checkin.findOneAndUpdate(
    { userId, placeId: Number(placeId), createdAt: { $gt: since } },
    { level, createdAt: new Date() },
    { new: true, sort: { createdAt: -1 } }
  );
  return recent || Checkin.create({ userId, placeId: Number(placeId), level });
};

/* The newest check-in per place, keyed by placeId, for GET /places (one query) */
exports.latestAll = async () => {
  const all = global.MOCK_MODE ? newestFirst(mem) : await Checkin.find().sort({ createdAt: -1 });
  const result = {};
  for (const c of all) {
    if (!result[c.placeId]) result[c.placeId] = c;
  }
  return result;
};

exports.deleteAllForUser = async (userId) => {
  if (global.MOCK_MODE) { mem = mem.filter(c => c.userId !== String(userId)); return; }
  return Checkin.deleteMany({ userId });
};

exports.deleteAllForPlace = async (placeId) => {
  if (global.MOCK_MODE) { mem = mem.filter(c => c.placeId !== Number(placeId)); return; }
  return Checkin.deleteMany({ placeId: Number(placeId) });
};

exports.Checkin = Checkin;
