const express = require('express')
const reportsController = require('../controllers/reports-controller')
const authenticate = require('../middleware/auth-middleware')
const requireAdmin = require('../middleware/admin-middleware')

const router = express.Router()

router.post('/', authenticate, reportsController.createReport)
router.get('/admin', authenticate, requireAdmin, reportsController.getReports)
router.patch('/admin/:id/status', authenticate, requireAdmin, reportsController.updateStatus)
router.delete('/admin/:id', authenticate, requireAdmin, reportsController.deleteReport)

module.exports = router
