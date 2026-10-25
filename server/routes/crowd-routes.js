const express = require('express')
const crowdController = require('../controllers/crowd-controller')
const authenticate = require('../middleware/auth-middleware')

const router = express.Router()

// reading is public; reporting needs a logged-in user
router.get('/place/:placeId', crowdController.getPlaceCrowd)
router.get('/mine/:placeId', authenticate, crowdController.getMyCheckin)
router.post('/:placeId', authenticate, crowdController.checkIn)
router.delete('/:placeId', authenticate, crowdController.undoCheckin)

module.exports = router
