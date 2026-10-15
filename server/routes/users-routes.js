const express = require('express')
const usersController = require('../controllers/users-controller')
const authenticate = require('../middleware/auth-middleware')
const requireAdmin = require('../middleware/admin-middleware')

const router = express.Router()

router.post('/register', usersController.register)
router.post('/login', usersController.login)

router.get('/admin', authenticate, requireAdmin, usersController.getAllUsers)
router.put('/admin/:id', authenticate, requireAdmin, usersController.updateUserByAdmin)
router.put('/admin/:id/role', authenticate, requireAdmin, usersController.updateUserRole)
router.delete('/admin/:id', authenticate, requireAdmin, usersController.deleteUserByAdmin)

router.get('/profile', authenticate, usersController.getProfile)
router.put('/profile', authenticate, usersController.updateProfile)
router.put('/profile/password', authenticate, usersController.changePassword)
router.delete('/profile', authenticate, usersController.deleteAccount)

module.exports = router
