/* Search controller. Follows the routes -> controllers -> models convention.
 * Uses placeModel.retrieveAll() so it works in both MOCK_MODE and MongoDB mode,
 * and summarisePlaces() so results carry the same live status, crowd level and
 * review-based rating as GET /places. */

const placeModel = require('../models/place-model');
const { summarisePlaces } = require('../utils/place-summary');

const norm = (s) => String(s).trim().toLowerCase();

// GET /search?q=&facilities=wifi,aircon&strict=true&area=&minRating=
exports.search = async (req, res, next) => {
  try {
    const all = await summarisePlaces(await placeModel.retrieveAll());

    const q = norm(req.query.q || '');
    const wanted = (req.query.facilities || '').split(',').map(norm).filter(Boolean);
    const strict = req.query.strict === 'true';
    const area = norm(req.query.area || '');
    const minRating = Number(req.query.minRating) || 0;

    const results = all.filter((p) => {
      if (q) {
        const haystack = [p.name, p.address, p.area, p.description, ...(p.tags || [])].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (area && norm(p.area || '') !== area) return false;
      if (minRating && !(p.rating >= minRating)) return false;
      if (strict && wanted.length) {
        const have = (p.facilities || []).map(norm);
        if (!wanted.every((f) => have.includes(f))) return false;
      }
      return true;
    });

    // Filter options come from the data itself, so they always match what is stored
    const facilityOptions = [...new Set(all.flatMap((p) => p.facilities || []))].sort();
    const areaOptions = [...new Set(all.map((p) => p.area).filter(Boolean))].sort();

    res.json({ results, facilityOptions, areaOptions });
  } catch (err) {
    next(err);
  }
};