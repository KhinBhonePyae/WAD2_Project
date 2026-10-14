const express = require('express');
const reviewsController = require('../controllers/reviews-controller');
const authenticate = require('../middleware/auth-middleware');
const router = express.Router();

router.get('/place/:placeId', reviewsController.getByPlace);
// reading is public; writing needs a logged-in user
router.post('/', authenticate, reviewsController.addReview);
router.put('/:id', authenticate, reviewsController.editReview);
router.delete('/:id', authenticate, reviewsController.deleteReview);

module.exports = router;
