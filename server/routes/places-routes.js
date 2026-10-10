const express = require('express');
const placesController = require('../controllers/places-controller');
const router = express.Router();

router.get('/', placesController.getPlaces);
router.get('/:id', placesController.getPlace);
router.post('/', placesController.addPlace);
router.put('/:id', placesController.editPlace);
router.delete('/:id', placesController.deletePlace);

module.exports = router;
