const express = require('express')
const savedController = require('../controllers/saved-controller')
const authenticate = require('../middleware/auth-middleware')

const router = express.Router()

router.get('/', authenticate, savedController.getSavedPlaces)
router.post('/:placeId', authenticate, savedController.savePlace)
router.delete('/:placeId', authenticate, savedController.removeSavedPlace)

module.exports = router