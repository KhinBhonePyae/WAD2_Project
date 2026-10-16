/* Copies data/places.json into the MongoDB `places` collection.
 * Run with: pnpm seed  (or npm run seed)
 * Safe to re-run: each place is matched by its `id` and replaced,
 * so nothing is duplicated and places added through the app are kept. */
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const places = require('./data/places.json');
const { Place } = require('./models/place-model');

dotenv.config({ path: path.join(__dirname, 'config.env') });

async function seed() {
  if (!process.env.DB) {
    console.log('No DB string in config.env - nothing to seed.');
    return;
  }
  try {
    await mongoose.connect(process.env.DB, { serverSelectionTimeoutMS: 5000 });
    for (const place of places) {
      await Place.replaceOne({ id: place.id }, place, { upsert: true });
    }
    console.log(`Seeded ${places.length} places into MongoDB.`);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
