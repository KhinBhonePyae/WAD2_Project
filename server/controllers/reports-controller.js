const reportModel = require('../models/report-model')
const placeModel = require('../models/place-model')

const CATEGORIES = ['hours', 'facilities', 'address', 'photos', 'capacity', 'closure', 'other']
const STATUSES = ['pending', 'resolved']

/* POST /reports - logged-in users submit incorrect place information */
exports.createReport = async (req, res, next) => {
  try {
    const placeId = Number(req.body.placeId)
    const category = String(req.body.category || '').trim()
    const message = String(req.body.message || '').trim()

    if (!Number.isInteger(placeId)) return res.status(400).json({ error: 'A valid study space is required.' })
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose what information is incorrect.' })
    if (message.length < 5) return res.status(400).json({ error: 'Please give a little more detail about the issue.' })
    if (message.length > 600) return res.status(400).json({ error: 'Report details must be 600 characters or fewer.' })

    const place = await placeModel.findByID(placeId)
    if (!place) return res.status(404).json({ error: 'Study space not found.' })

    const report = await reportModel.createReport({
      placeId,
      placeName: place.name,
      userId: req.user?._id || req.userId,
      reporterName: req.user?.name || 'LockedIN user',
      reporterEmail: req.user?.email || '',
      category,
      message
    })

    res.status(201).json({ message: 'Thanks! Your report has been sent to the admin team.', report })
  } catch (error) {
    next(error)
  }
}

/* GET /reports/admin - admin only */
exports.getReports = async (req, res, next) => {
  try {
    const reports = await reportModel.getAllReports()
    res.json({ reports })
  } catch (error) {
    next(error)
  }
}

/* PATCH /reports/admin/:id/status - admin only */
exports.updateStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '')
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status must be pending or resolved.' })

    const report = await reportModel.updateStatus(req.params.id, status, req.userId)
    if (!report) return res.status(404).json({ error: 'Report not found.' })

    res.json({ message: status === 'resolved' ? 'Report marked as resolved.' : 'Report reopened.', report })
  } catch (error) {
    next(error)
  }
}

/* DELETE /reports/admin/:id - admin only */
exports.deleteReport = async (req, res, next) => {
  try {
    const report = await reportModel.deleteReport(req.params.id)
    if (!report) return res.status(404).json({ error: 'Report not found.' })
    res.json({ message: 'Report deleted.' })
  } catch (error) {
    next(error)
  }
}
