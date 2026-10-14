const express = require('express')
const placesController = require('../controllers/places-controller')
const authenticate = require('../middleware/auth-middleware')
const requireAdmin = require('../middleware/admin-middleware')

const router = express.Router()

router.get('/', placesController.getPlaces)
router.get('/:id/map-location', placesController.getMapLocation)
router.post('/:id/map-route', placesController.getMapRoute)
router.get('/:id', placesController.getPlace)

router.post('/', authenticate, requireAdmin, placesController.addPlace)
router.put('/:id', authenticate, requireAdmin, placesController.editPlace)
router.delete('/:id', authenticate, requireAdmin, placesController.deletePlace)

module.exports = router