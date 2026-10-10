const express = require('express')
const usersController = require('../controllers/users-controller')
const authenticate = require('../middleware/auth-middleware')

const router = express.Router()

router.post('/register', usersController.register)
router.post('/login', usersController.login)
router.get('/profile', authenticate, usersController.getProfile)
router.put('/profile', authenticate, usersController.updateProfile)
router.delete('/profile', authenticate, usersController.deleteAccount)

module.exports = router