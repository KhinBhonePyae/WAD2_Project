/* Place model. Follows the wk5 pattern: the model file is also the
 * data-access layer and exports named CRUD helpers. */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const placeSchema = new mongoose.Schema({
  id:          { type: Number, required: true },
  name:        { type: String, required: true, trim: true },
  address:     { type: String, default: '' },
  area:        { type: String, default: '' },
  lat:         { type: Number }, lon: { type: Number },
  indoor:      { type: Boolean, default: true },
  openNow:     { type: Boolean, default: true },
  hours:       { type: String, default: '' },
  facilities:  { type: [String], default: [] },
  tags:        { type: [String], default: [] },
  photo:       { type: String, default: '' },
  photos:      { type: [String], default: [] },
  rating:      { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  description: { type: String, default: '' },
}, { versionKey: false });

const Place = mongoose.model('Place', placeSchema, 'places');

// --- mock-mode source -------------------------------------------------
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'places.json'), 'utf8'));

exports.retrieveAll = async () => {
  if (global.MOCK_MODE) return seed;
  return Place.find();
};

exports.findByID = async (id) => {
  if (global.MOCK_MODE) return seed.find(p => p.id === Number(id)) || null;
  return Place.findOne({ id: Number(id) });
};

exports.createPlace = async (data) => {
  if (global.MOCK_MODE) {
    const nextId = seed.length ? Math.max(...seed.map(p => p.id)) + 1 : 1;
    const newPlace = {
      address: '', area: '', indoor: true, openNow: true, hours: '',
      facilities: [], tags: [], photo: '', photos: [],
      rating: 0, reviewCount: 0, description: '',
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
