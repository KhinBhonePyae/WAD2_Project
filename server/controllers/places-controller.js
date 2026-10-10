const placeModel = require('../models/place-model');
const reviewModel = require('../models/review-model');

/* GET /places  - optional ?q= &facilities=wifi,sockets &indoor=true|false &openNow=true */
exports.getPlaces = async (req, res, next) => {
  try {
    let list = await placeModel.retrieveAll();
    list = list.map(p => (p.toObject ? p.toObject() : { ...p }));

    const q = (req.query.q || '').trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.area || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q));
    }
    if (req.query.facilities) {
      const want = req.query.facilities.split(',').filter(Boolean);
      list = list.filter(p => want.every(f => p.facilities.includes(f)));
    }
    if (req.query.indoor === 'true')  list = list.filter(p => p.indoor === true);
    if (req.query.indoor === 'false') list = list.filter(p => p.indoor === false);
    if (req.query.openNow === 'true') list = list.filter(p => p.openNow === true);

    // attach the live crowd level from the latest review
    for (const p of list) {
      const agg = await reviewModel.aggregateForPlace(p.id);
      p.crowdLevel = agg.crowdLevel;
      if (agg.reviewCount) { p.rating = agg.rating; p.reviewCount = agg.reviewCount; }
    }
    res.json(list);
  } catch (e) { next(e); }
};

/* GET /places/:id */
exports.getPlace = async (req, res, next) => {
  try {
    const found = await placeModel.findByID(req.params.id);
    if (!found) return res.status(404).json({ error: 'Place not found' });
    const place = found.toObject ? found.toObject() : { ...found };
    const agg = await reviewModel.aggregateForPlace(place.id);
    place.crowdLevel = agg.crowdLevel;
    if (agg.reviewCount) { place.rating = agg.rating; place.reviewCount = agg.reviewCount; }
    res.json(place);
  } catch (e) { next(e); }
};

/* POST /places */
exports.addPlace = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name || !data.name.trim())
      return res.status(400).json({ error: 'Place name is required' });

    const newPlace = await placeModel.createPlace(data);
    res.status(201).json(newPlace);
  } catch (e) { next(e); }
};

/* PUT /places/:id */
exports.editPlace = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name || !data.name.trim())
      return res.status(400).json({ error: 'Place name is required' });

    const updated = await placeModel.updatePlace(req.params.id, data);
    if (!updated) return res.status(404).json({ error: 'Place not found' });

    res.json(updated);
  } catch (e) { next(e); }
};

/* DELETE /places/:id */
exports.deletePlace = async (req, res, next) => {
  try {
    const deleted = await placeModel.deletePlace(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Place not found' });

    res.json(deleted);
  } catch (e) { next(e); }
};