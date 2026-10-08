/* Review model + data-access helpers. This is Jeffrey's area:
 * ratings, reviews and crowd reporting. */
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  placeId:    { type: Number, required: true },
  author:     { type: String, required: true, trim: true, maxlength: 60 },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  comment:    { type: String, default: '', maxlength: 600, trim: true },
  crowdLevel: { type: String, enum: ['quiet', 'moderate', 'packed'], default: 'moderate' },
  createdAt:  { type: Date, default: Date.now, immutable: true },
  updatedAt:  { type: Date, default: Date.now },
}, { versionKey: false });

reviewSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });
reviewSchema.pre(['findOneAndUpdate', 'updateOne'], function (next) {
  this.set({ updatedAt: new Date() }); next();
});

const Review = mongoose.model('Review', reviewSchema, 'reviews');

// --- mock-mode store --------------------------------------------------
let mem = [
  { _id: 'm1', placeId: 1, author: 'Wei Ling', rating: 5, comment: 'Level 5 is genuinely silent. Got a socket seat at 9am.', crowdLevel: 'quiet',    createdAt: new Date('2026-09-30') },
  { _id: 'm2', placeId: 1, author: 'Arjun',    rating: 4, comment: 'Great until 2pm, then it fills up fast.',              crowdLevel: 'moderate', createdAt: new Date('2026-10-02') },
  { _id: 'm3', placeId: 2, author: 'Siti',     rating: 4, comment: 'Courtyard is lovely when it is not raining.',          crowdLevel: 'moderate', createdAt: new Date('2026-10-01') },
];
let nextId = 4;

exports.findByPlace = async (placeId) => {
  if (global.MOCK_MODE) {
    return mem.filter(r => r.placeId === Number(placeId))
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return Review.find({ placeId: Number(placeId) }).sort({ createdAt: -1 });
};

exports.addReview = async (data) => {
  if (global.MOCK_MODE) {
    const doc = { _id: 'm' + (nextId++), ...data, placeId: Number(data.placeId), createdAt: new Date() };
    mem.unshift(doc);
    return doc;
  }
  return Review.create(data);
};

exports.editReview = async (id, fields) => {
  if (global.MOCK_MODE) {
    const r = mem.find(x => x._id === id);
    if (!r) return null;
    Object.assign(r, fields, { updatedAt: new Date() });
    return r;
  }
  return Review.findByIdAndUpdate(id, { ...fields, updatedAt: new Date() }, { new: true });
};

exports.deleteReview = async (id) => {
  if (global.MOCK_MODE) {
    const before = mem.length;
    mem = mem.filter(x => x._id !== id);
    return { deletedCount: before - mem.length };
  }
  return Review.deleteOne({ _id: id });
};

/* Aggregate rating + crowd level for one place.
 * Crowd is the most recent report, because "how busy is it right now"
 * is a now-question, not an average. */
exports.aggregateForPlace = async (placeId) => {
  const list = await exports.findByPlace(placeId);
  if (!list.length) return { rating: 0, reviewCount: 0, crowdLevel: null };
  const sum = list.reduce((t, r) => t + r.rating, 0);
  return {
    rating: Math.round((sum / list.length) * 10) / 10,
    reviewCount: list.length,
    crowdLevel: list[0].crowdLevel || null,
  };
};
