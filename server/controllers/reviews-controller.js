/* Reviews, ratings and crowd reports.
 * Owner: Jeffrey Wen. Full CRUD - this is the pitch's "functioning task". */
const reviewModel = require('../models/review-model');
const placeModel = require('../models/place-model');

async function resync(placeId) {
  const agg = await reviewModel.aggregateForPlace(placeId);
  await placeModel.updateAggregate(placeId, agg.rating, agg.reviewCount);
  return agg;
}

/* GET /reviews/place/:placeId */
exports.getByPlace = async (req, res, next) => {
  try {
    const list = await reviewModel.findByPlace(req.params.placeId);
    const agg = await reviewModel.aggregateForPlace(req.params.placeId);
    res.json({ reviews: list, summary: agg });
  } catch (e) { next(e); }
};

/* POST /reviews */
exports.addReview = async (req, res, next) => {
  try {
    const { placeId, author, rating, comment, crowdLevel } = req.body;
    if (!placeId || !author || !rating) {
      return res.status(400).json({ error: 'placeId, author and rating are required' });
    }
    const n = Number(rating);
    if (Number.isNaN(n) || n < 1 || n > 5) {
      return res.status(400).json({ error: 'rating must be a number from 1 to 5' });
    }
    const doc = await reviewModel.addReview({
      placeId: Number(placeId), author: String(author).trim(), rating: n,
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
      if (Number.isNaN(n) || n < 1 || n > 5) {
        return res.status(400).json({ error: 'rating must be a number from 1 to 5' });
      }
      fields.rating = n;
    }
    if (comment !== undefined) fields.comment = String(comment).trim();
    if (crowdLevel !== undefined && ['quiet', 'moderate', 'packed'].includes(crowdLevel)) {
      fields.crowdLevel = crowdLevel;
    }
    const updated = await reviewModel.editReview(req.params.id, fields);
    if (!updated) return res.status(404).json({ error: 'Review not found' });
    const summary = await resync(updated.placeId);
    res.json({ review: updated, summary });
  } catch (e) { next(e); }
};

/* DELETE /reviews/:id?placeId=1 */
exports.deleteReview = async (req, res, next) => {
  try {
    const result = await reviewModel.deleteReview(req.params.id);
    if (!result || result.deletedCount !== 1) {
      return res.status(404).json({ error: 'Review not found' });
    }
    const summary = req.query.placeId ? await resync(req.query.placeId) : null;
    res.json({ deleted: true, summary });
  } catch (e) { next(e); }
};
