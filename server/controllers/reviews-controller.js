/* Reviews, ratings and crowd reports.
 * Owner: Jeffrey Wen. Full CRUD - this is the pitch's "functioning task". */
const reviewModel = require('../models/review-model');
const placeModel = require('../models/place-model');
const userModel = require('../models/user-model');

// Only the person who wrote a review may change or delete it
async function findOwnReview(id, userId, res) {
  const review = await reviewModel.findById(id);
  if (!review) { res.status(404).json({ error: 'Review not found' }); return null; }
  if (!review.userId || String(review.userId) !== String(userId)) {
    res.status(403).json({ error: 'You can only change your own reviews' });
    return null;
  }
  return review;
}

async function resync(placeId) {
  const agg = await reviewModel.aggregateForPlace(placeId);
  await placeModel.updateAggregate(placeId, agg.rating, agg.reviewCount);
  return agg;
}

/* GET /reviews/place/:placeId */
exports.getByPlace = async (req, res, next) => {
  try {
    if (!Number.isInteger(Number(req.params.placeId))) {
      return res.status(404).json({ error: 'Place not found' });
    }
    const list = await reviewModel.findByPlace(req.params.placeId);
    const agg = await reviewModel.aggregateForPlace(req.params.placeId);
    res.json({ reviews: list, summary: agg });
  } catch (e) { next(e); }
};

/* POST /reviews */
exports.addReview = async (req, res, next) => {
  try {
    const { placeId, rating, comment, crowdLevel } = req.body;
    if (!placeId || !rating) {
      return res.status(400).json({ error: 'placeId and rating are required' });
    }
    // the author name comes from the logged-in account, not from the form
    const user = await userModel.findByID(req.userId);
    if (!user) return res.status(401).json({ error: 'Please log in again' });
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return res.status(400).json({ error: 'rating must be a whole number from 1 to 5' });
    }
    if (!(await placeModel.findByID(placeId))) {
      return res.status(404).json({ error: 'Place not found' });
    }
    const doc = await reviewModel.addReview({
      placeId: Number(placeId), userId: user._id, author: user.name, rating: n,
      comment: (comment || '').trim(),
      crowdLevel: ['quiet', 'moderate', 'packed'].includes(crowdLevel) ? crowdLevel : 'moderate',
    });
    const summary = await resync(placeId);
    res.status(201).json({ review: doc, summary });
  } catch (e) { next(e); }
};

/* PUT /reviews/:id */
exports.editReview = async (req, res, next) => {
  try {
    const { rating, comment, crowdLevel } = req.body;
    const fields = {};
    if (rating !== undefined) {
      const n = Number(rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({ error: 'rating must be a whole number from 1 to 5' });
      }
      fields.rating = n;
    }
    if (comment !== undefined) fields.comment = String(comment).trim();
    if (crowdLevel !== undefined && ['quiet', 'moderate', 'packed'].includes(crowdLevel)) {
      fields.crowdLevel = crowdLevel;
    }
    if (!(await findOwnReview(req.params.id, req.userId, res))) return;
    const updated = await reviewModel.editReview(req.params.id, fields);
    if (!updated) return res.status(404).json({ error: 'Review not found' });
    const summary = await resync(updated.placeId);
    res.json({ review: updated, summary });
  } catch (e) { next(e); }
};

/* DELETE /reviews/:id?placeId=1 */
exports.deleteReview = async (req, res, next) => {
  try {
    const own = await findOwnReview(req.params.id, req.userId, res);
    if (!own) return;
    const result = await reviewModel.deleteReview(req.params.id);
    if (!result || result.deletedCount !== 1) {
      return res.status(404).json({ error: 'Review not found' });
    }
    const summary = await resync(own.placeId);
    res.json({ deleted: true, summary });
  } catch (e) { next(e); }
};
