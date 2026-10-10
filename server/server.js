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
const mongoose = require('mongoose');
const cors = require('cors');

dotenv.config({ path: './config.env' });

const placesRoutes = require('./routes/places-routes');
const reviewsRoutes = require('./routes/reviews-routes');
const searchRoutes = require('./routes/search-routes'); // search bar

const server = express();

server.use(express.urlencoded({ extended: true }));
server.use(cors());               // dev only: allows the Vite client on :5173
server.use(express.json());
server.use('/search', searchRoutes) // search bar

server.get('/health', (req, res) => {
  res.json({ ok: true, mode: global.MOCK_MODE ? 'mock' : 'mongodb' });
});

server.use('/places', placesRoutes);
server.use('/reviews', reviewsRoutes);
server.use('/users', usersRoutes); 

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
    await mongoose.connect(process.env.DB);
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
