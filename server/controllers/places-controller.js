const placeModel = require('../models/place-model');
const reviewModel = require('../models/review-model');

const ALLOWED_FACILITIES = ['wifi', 'sockets', 'toilets', 'water', 'fnb', 'quiet'];

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function validPhotoSource(photo) {
  if (!photo) return true;
  if (photo.startsWith('/images/')) return true;

  try {
    const url = new URL(photo);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validatePlace(data) {
  const name = data.name?.trim();
  const area = data.area?.trim();
  const address = data.address?.trim();
  const description = data.description?.trim();
  const lat = Number(data.lat);
  const lon = Number(data.lon);

  if (!name) return 'Name is required.';
  if (name.length < 2 || name.length > 100) return 'Name must be between 2 and 100 characters.';
  if (!/[A-Za-z]/.test(name)) return 'Name must contain letters.';

  if (!area) return 'Area is required.';
  if (area.length < 2 || area.length > 80) return 'Area must be between 2 and 80 characters.';
  if (!/[A-Za-z]/.test(area)) return 'Area must contain letters.';

  if (!address) return 'Address is required.';
  if (address.length < 5 || address.length > 200) return 'Address must be between 5 and 200 characters.';
  if (!/[A-Za-z]/.test(address)) return 'Address must contain letters.';

  if (data.lat === null || data.lat === undefined || data.lat === '') return 'Latitude is required.';
  if (!Number.isFinite(lat)) return 'Latitude must be a valid number.';
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';

  if (data.lon === null || data.lon === undefined || data.lon === '') return 'Longitude is required.';
  if (!Number.isFinite(lon)) return 'Longitude must be a valid number.';
  if (lon < -180 || lon > 180) return 'Longitude must be between -180 and 180.';

  if (!data.hours) return 'Opening hours are required.';
  // A closed place (e.g. NLB branches under renovation) has no opening times
  const closedNoHours = data.openNow === false && data.hours === 'Closed for renovation';
  if (!closedNoHours) {
    if (!/^([01]\d|2[0-3]):[0-5]\d - ([01]\d|2[0-3]):[0-5]\d$/.test(data.hours)) return 'Opening hours must use HH:MM - HH:MM format.';

    const [openTime, closeTime] = data.hours.split(' - ');
    if (timeToMinutes(closeTime) <= timeToMinutes(openTime)) return 'Closing time must be later than opening time.';
  }

  if (typeof data.indoor !== 'boolean') return 'Location must be indoor or outdoor.';
  if (typeof data.openNow !== 'boolean') return 'Status must be open or closed.';

  if (!Array.isArray(data.facilities)) return 'Facilities must be an array.';
  if (data.facilities.some(f => !ALLOWED_FACILITIES.includes(f))) return 'One or more facilities are invalid.';

  if (!Array.isArray(data.photos)) return 'Photos must be an array.';
  if (data.photos.length === 0) return 'At least one photo is required.';
  if (data.photos.some(photo => typeof photo !== 'string' || !photo.trim() || !validPhotoSource(photo.trim()))) return 'One or more photo URLs are invalid.';

  if (!description) return 'Description is required.';

  return null;
}

/* GET /places - optional ?q= &facilities=wifi,sockets &indoor=true|false &openNow=true */
exports.getPlaces = async (req, res, next) => {
  try {
    let list = await placeModel.retrieveAll();
    list = list.map(p => (p.toObject ? p.toObject() : { ...p }));

    const q = (req.query.q || '').trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.area || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    }

    if (req.query.facilities) {
      const want = req.query.facilities.split(',').filter(Boolean);
      list = list.filter(p => want.every(f => (p.facilities || []).includes(f)));
    }

    if (req.query.indoor === 'true') list = list.filter(p => p.indoor === true);
    if (req.query.indoor === 'false') list = list.filter(p => p.indoor === false);
    if (req.query.openNow === 'true') list = list.filter(p => p.openNow === true);

    // attach the live crowd level from the latest review (one query for all places)
    const aggs = await reviewModel.aggregateAll();
    for (const p of list) {
      const agg = aggs[p.id] || { rating: 0, reviewCount: 0, crowdLevel: null };
      p.crowdLevel = agg.crowdLevel;
      if (agg.reviewCount) {
        p.rating = agg.rating;
        p.reviewCount = agg.reviewCount;
      }
    }

    res.json(list);
  } catch (e) {
    next(e);
  }
};

/* GET /places/:id */
exports.getPlace = async (req, res, next) => {
  try {
    const found = await placeModel.findByID(req.params.id);
    if (!found) return res.status(404).json({ error: 'Place not found' });

    const place = found.toObject ? found.toObject() : { ...found };
    const agg = await reviewModel.aggregateForPlace(place.id);

    place.crowdLevel = agg.crowdLevel;

    if (agg.reviewCount) {
      place.rating = agg.rating;
      place.reviewCount = agg.reviewCount;
    }

    res.json(place);
  } catch (e) {
    next(e);
  }
};

/* POST /places */
exports.addPlace = async (req, res, next) => {
  try {
    const data = req.body;
    const error = validatePlace(data);

    if (error) return res.status(400).json({ error });

    const newPlace = await placeModel.createPlace({
      ...data,
      name: data.name.trim(),
      area: data.area.trim(),
      address: data.address.trim(),
      description: data.description.trim(),
      lat: Number(data.lat),
      lon: Number(data.lon),
      photos: data.photos.map(photo => photo.trim())
    });

    res.status(201).json(newPlace);
  } catch (e) {
    next(e);
  }
};

/* PUT /places/:id */
exports.editPlace = async (req, res, next) => {
  try {
    const data = req.body;
    const error = validatePlace(data);

    if (error) return res.status(400).json({ error });

    const updated = await placeModel.updatePlace(req.params.id, {
      ...data,
      name: data.name.trim(),
      area: data.area.trim(),
      address: data.address.trim(),
      description: data.description.trim(),
      lat: Number(data.lat),
      lon: Number(data.lon),
      photos: data.photos.map(photo => photo.trim())
    });

    if (!updated) return res.status(404).json({ error: 'Place not found' });

    res.json(updated);
  } catch (e) {
    next(e);
  }
};

/* DELETE /places/:id */
exports.deletePlace = async (req, res, next) => {
  try {
    const deleted = await placeModel.deletePlace(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Place not found' });

    res.json(deleted);
  } catch (e) {
    next(e);
  }
};