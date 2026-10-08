const express = require('express');
const reviewsController = require('../controllers/reviews-controller');
const router = express.Router();

router.get('/place/:placeId', reviewsController.getByPlace);
router.post('/', reviewsController.addReview);
router.put('/:id', reviewsController.editReview);
router.delete('/:id', reviewsController.deleteReview);

module.exports = router;
