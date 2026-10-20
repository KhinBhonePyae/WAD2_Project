/* StudySpot SG - API server
 * Follows the IS216 wk5 convention: CommonJS, express + mongoose,
 * dotenv reading ./config.env, routes -> controllers -> models.
 *
 * PROTOTYPE AFFORDANCE: if config.env has no DB string, the server
 * starts anyway in "mock mode" and serves data/places.json with
 * reviews held in memory. That lets every teammate run the app on
 * day one without Atlas credentials. Remove mock mode once the real
 * database is wired up.
 */
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');

dotenv.config({ path: path.join(__dirname, 'config.env') });

// DEMO ONLY: lets sign-up work on a fresh clone with no config.env.
// Set a real JWT_SECRET in config.env before deploying.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'studyspot-dev-secret';
  console.warn('JWT_SECRET not set in config.env - using an insecure dev default.');
}

// optional keys: the app still runs without them, but say which features are off
if (!process.env.GEMINI_API_KEY) console.warn('GEMINI_API_KEY not set in config.env - AI study assistant disabled.');
if (!process.env.ONEMAP_EMAIL || !process.env.ONEMAP_PASSWORD) {
  console.warn(process.env.ONEMAP_TOKEN
    ? 'ONEMAP_EMAIL/ONEMAP_PASSWORD not set - using the fixed ONEMAP_TOKEN, so directions stop when it expires (every 3 days).'
    : 'ONEMAP_EMAIL/ONEMAP_PASSWORD not set in config.env - map directions disabled.');
}

const placesRoutes = require('./routes/places-routes');
const reviewsRoutes = require('./routes/reviews-routes');
const usersRoutes = require('./routes/users-routes');
const searchRoutes = require('./routes/search-routes'); // search bar
const savedRoutes = require('./routes/saved-routes');
const intentsRoutes = require('./routes/intents-routes');
const aiRoutes = require('./routes/ai-routes');
const worldChatRoutes = require('./routes/world-chat-routes');
const reportsRoutes = require('./routes/reports-routes');

const server = express();

server.use(express.urlencoded({ extended: true }));
server.use(cors());               // dev only: allows the Vite client on :5173
server.use(express.json());


server.get('/health', (req, res) => {
  res.json({ ok: true, mode: global.MOCK_MODE ? 'mock' : 'mongodb' });
});

server.use('/places', placesRoutes);
server.use('/reviews', reviewsRoutes);
server.use('/users', usersRoutes);
server.use('/search', searchRoutes) // search bar
server.use('/saved', savedRoutes); // saved places
server.use('/intents', intentsRoutes); // "planning to go" intents
server.use('/ai', aiRoutes);
server.use('/world-chat', worldChatRoutes);
server.use('/reports', reportsRoutes);

// 404 + error handler (borrowed from the better-engineered wk5 blog example)
server.use((req, res) => res.status(404).json({ error: 'Not found' }));
server.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function connectDB() {
  if (!process.env.DB) {
    global.MOCK_MODE = true;
    console.log('No DB string in config.env - starting in MOCK MODE (data/places.json, in-memory reviews).');
    return;
  }
  try {
    // Give up after 5s (default is 30s) so a blocked Atlas IP falls back to mock mode quickly.
    await mongoose.connect(process.env.DB, { serverSelectionTimeoutMS: 5000 });
    global.MOCK_MODE = false;
    console.log('MongoDB connected successfully');
  } catch (error) {
    global.MOCK_MODE = true;
    console.error('MongoDB connection failed:', error.message);
    console.log('Falling back to MOCK MODE so the app still runs.');
  }
}

function startServer() {
  const hostname = 'localhost';
  const port = 8000;
  server.listen(port, hostname, () => {
    console.log(`StudySpot API running at http://${hostname}:${port}/`);
  });
}

connectDB().then(startServer);
