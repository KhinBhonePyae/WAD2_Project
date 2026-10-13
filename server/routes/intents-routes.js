const express = require('express')
const intentsController = require('../controllers/intents-controller')
const authenticate = require('../middleware/auth-middleware')

const router = express.Router()

router.get('/place/:placeId', intentsController.getPlaceIntents)
router.get('/mine', authenticate, intentsController.getMyIntents)
router.post('/:placeId', authenticate, intentsController.addIntent)
router.delete('/:placeId', authenticate, intentsController.removeIntent)

module.exports = router
