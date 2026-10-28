/* Place model. Follows the wk5 pattern: the model file is also the
 * data-access layer and exports named CRUD helpers. */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const placeSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  branchCode: { type: String, unique: true, sparse: true }, // NLB branch code, set by import-libraries.js
  name: { type: String, required: true, trim: true },
  address: { type: String, default: '' },
  area: { type: String, default: '' },
  lat: { type: Number }, lon: { type: Number },
  indoor: { type: Boolean, default: true },
  openNow: { type: Boolean, default: true },
  closureStatus: { type: String, enum: ['normal', 'temporary', 'permanent'], default: 'normal' },
  hours: { type: String, default: '' },
  facilities: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  photo: { type: String, default: '' },
  photos: { type: [String], default: [] },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  capacity: { type: Number, default: null }, // rough seat count, for the intent "how packed" level
  // What it costs to sit and study: libraries are free, cafes expect a purchase,
  // coworking spaces need a day pass or membership. '' = not set yet.
  entry: { type: String, enum: ['free', 'purchase', 'pass', ''], default: '' },
  description: { type: String, default: '' },

  // Set by import-google-places.js. Google's rating is kept apart from ours:
  // rating/reviewCount above are always rebuilt from in-app reviews.
  googlePlaceId: { type: String, unique: true, sparse: true },
  googleLinked: { type: Boolean, default: false }, // our own place (e.g. NLB) linked to Google Places
  googleLookupFailedAt: { type: Date, default: null }, // no Google match found; not retried unless --force
  placeType: { type: String, default: '' }, // Google primaryType, e.g. 'cafe', 'library', 'coworking_space'
  googleRating: { type: Number, default: null },
  googleRatingCount: { type: Number, default: 0 },
  // Google's weekly hours, day 0 = Sunday. Close may fall on the next day (past midnight).
  openingPeriods: {
    type: [{ _id: false, open: { day: Number, hour: Number, minute: Number }, close: { day: Number, hour: Number, minute: Number } }],
    default: [],
  },
  weekdayHours: { type: [String], default: [] }, // e.g. "Monday: 8:00 AM – 10:00 PM"
  photoAttributions: { type: [String], default: [] },
  googleMapsUri: { type: String, default: '' },
  website: { type: String, default: '' },
  googleSyncedAt: { type: Date, default: null },
}, { versionKey: false });

const Place = mongoose.model('Place', placeSchema, 'places');

// mock-mode source 
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'places.json'), 'utf8'));

exports.retrieveAll = async () => {
  if (global.MOCK_MODE) return seed;
  return Place.find();
};

exports.findByID = async (id) => {
  if (!Number.isInteger(Number(id))) return null; // e.g. /places/abc -> 404
  if (global.MOCK_MODE) return seed.find(p => p.id === Number(id)) || null;
  return Place.findOne({ id: Number(id) });
};

exports.createPlace = async (data) => {
  if (global.MOCK_MODE) {
    const nextId = seed.length ? Math.max(...seed.map(p => p.id)) + 1 : 1;
    const newPlace = {
      address: '', area: '', indoor: true, openNow: true, closureStatus: 'normal', hours: '',
      facilities: [], tags: [], photo: '', photos: [],
      rating: 0, reviewCount: 0, capacity: null, description: '',
      ...data,
      id: nextId
    };

    seed.push(newPlace);
    return newPlace;
  }

  const lastPlace = await Place.findOne().sort({ id: -1 });
  const nextId = lastPlace ? lastPlace.id + 1 : 1;
  return Place.create({ ...data, id: nextId });
};

exports.updatePlace = async (id, data) => {
  if (!Number.isInteger(Number(id))) return null; // e.g. /places/abc -> 404
  if (global.MOCK_MODE) {
    const index = seed.findIndex(p => p.id === Number(id));
    if (index === -1) return null;

    seed[index] = { ...seed[index], ...data, id: Number(id) };
    return seed[index];
  }

  return Place.findOneAndUpdate(
    { id: Number(id) },
    { $set: data },
    { new: true, runValidators: true }
  );
};

exports.deletePlace = async (id) => {
  if (!Number.isInteger(Number(id))) return null; // e.g. /places/abc -> 404
  if (global.MOCK_MODE) {
    const index = seed.findIndex(p => p.id === Number(id));
    if (index === -1) return null;

    return seed.splice(index, 1)[0];
  }

  return Place.findOneAndDelete({ id: Number(id) });
};

exports.updateAggregate = async (id, rating, reviewCount) => {
  if (global.MOCK_MODE) {
    const p = seed.find(x => x.id === Number(id));
    if (p) { p.rating = rating; p.reviewCount = reviewCount; }
    return;
  }
  return Place.updateOne({ id: Number(id) }, { rating, reviewCount });
};

exports.Place = Place;
