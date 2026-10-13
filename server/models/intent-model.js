/* Intent model: "I'm planning to go to this place in this time slot".
 * One intent per user per place per slot (unique index).
 * expiresAt is the end of the slot; MongoDB's TTL index deletes old
 * intents automatically, and every query also ignores expired ones. */
const mongoose = require('mongoose');
const { slotEnd } = require('../utils/slots');

const intentSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  placeId:   { type: Number, required: true },
  date:      { type: String, required: true },   // 'YYYY-MM-DD', Singapore date
  slot:      { type: String, required: true, enum: ['morning', 'afternoon', 'evening'] },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

intentSchema.index({ userId: 1, placeId: 1, date: 1, slot: 1 }, { unique: true });
intentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Intent = mongoose.model('Intent', intentSchema, 'intents');

// --- mock-mode store --------------------------------------------------
let mem = [];

function live(list) {
  const now = new Date();
  return list.filter(i => i.expiresAt > now);
}

exports.findByUser = async (userId) => {
  if (global.MOCK_MODE) return live(mem.filter(i => i.userId === String(userId)));
  return Intent.find({ userId, expiresAt: { $gt: new Date() } });
};

exports.findByPlace = async (placeId) => {
  if (global.MOCK_MODE) return live(mem.filter(i => i.placeId === Number(placeId)));
  return Intent.find({ placeId: Number(placeId), expiresAt: { $gt: new Date() } });
};

// Every live intent for every place, for GET /places (one query)
exports.findAllLive = async () => {
  if (global.MOCK_MODE) return live(mem);
  return Intent.find({ expiresAt: { $gt: new Date() } });
};

exports.findIntent = async (userId, placeId, date, slot) => {
  if (global.MOCK_MODE) {
    return mem.find(i => i.userId === String(userId) && i.placeId === Number(placeId) &&
                         i.date === date && i.slot === slot) || null;
  }
  return Intent.findOne({ userId, placeId: Number(placeId), date, slot });
};

exports.addIntent = async (userId, placeId, date, slot) => {
  const data = { placeId: Number(placeId), date, slot, expiresAt: slotEnd(date, slot) };
  if (global.MOCK_MODE) {
    const doc = { _id: 'i' + Date.now() + Math.random(), userId: String(userId), ...data, createdAt: new Date() };
    mem.push(doc);
    return doc;
  }
  return Intent.create({ userId, ...data });
};

exports.removeIntent = async (userId, placeId, date, slot) => {
  if (global.MOCK_MODE) {
    const index = mem.findIndex(i => i.userId === String(userId) && i.placeId === Number(placeId) &&
                                     i.date === date && i.slot === slot);
    if (index === -1) return null;
    return mem.splice(index, 1)[0];
  }
  return Intent.findOneAndDelete({ userId, placeId: Number(placeId), date, slot });
};

exports.deleteAllForUser = async (userId) => {
  if (global.MOCK_MODE) { mem = mem.filter(i => i.userId !== String(userId)); return; }
  return Intent.deleteMany({ userId });
};

exports.deleteAllForPlace = async (placeId) => {
  if (global.MOCK_MODE) { mem = mem.filter(i => i.placeId !== Number(placeId)); return; }
  return Intent.deleteMany({ placeId: Number(placeId) });
};

exports.Intent = Intent;
