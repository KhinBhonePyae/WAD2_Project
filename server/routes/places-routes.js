const express = require('express');
const placesController = require('../controllers/places-controller');
const router = express.Router();

router.get('/', placesController.getPlaces);
router.get('/:id', placesController.getPlace);

module.exports = router;
