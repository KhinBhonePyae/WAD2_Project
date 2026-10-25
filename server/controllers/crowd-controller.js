const checkinModel = require('../models/checkin-model')
const reviewModel = require('../models/review-model')
const placeModel = require('../models/place-model')
const { closureStatusOf } = require('../utils/place-summary')

const LEVELS = ['quiet', 'moderate', 'packed']

/* GET /crowd/place/:placeId - every crowd report for a place (public).
 * Reports come from two real sources: one-tap check-ins and the crowd
 * level picked in each review. Newest first. */
exports.getPlaceCrowd = async (req, res, next) => {
  try {
    const placeId = Number(req.params.placeId)
    if (!Number.isInteger(placeId)) return res.status(404).json({ error: 'Place not found' })

    const [reviews, checkins] = await Promise.all([
      reviewModel.findByPlace(placeId),
      checkinModel.findByPlace(placeId)
    ])

    const reports = [
      ...checkins.map(c => ({ level: c.level, at: c.createdAt, source: 'check-in' })),
      ...reviews.filter(r => r.crowdLevel).map(r => ({ level: r.crowdLevel, at: r.createdAt, source: 'review' }))
    ].sort((a, b) => new Date(b.at) - new Date(a.at))

    const counts = { quiet: 0, moderate: 0, packed: 0 }
    for (const r of reports) counts[r.level]++

    res.json({ placeId, latest: reports[0] || null, counts, total: reports.length })
  } catch (e) {
    next(e)
  }
}

/* GET /crowd/mine/:placeId - the user's own check-in from the last hour, so the
 * page can show which level they picked and let them change or undo it */
exports.getMyCheckin = async (req, res, next) => {
  try {
    const recent = await checkinModel.findRecent(req.userId, Number(req.params.placeId))
    res.json({ level: recent ? recent.level : null })
  } catch (e) {
    next(e)
  }
}

/* DELETE /crowd/:placeId - undo the user's check-in from the last hour */
exports.undoCheckin = async (req, res, next) => {
  try {
    const removed = await checkinModel.removeRecent(req.userId, Number(req.params.placeId))
    if (!removed) return res.status(404).json({ error: 'No recent report to undo' })
    res.json({ message: 'Report removed' })
  } catch (e) {
    next(e)
  }
}

/* POST /crowd/:placeId  body: { level } - "I'm here, this is how busy it is" */
exports.checkIn = async (req, res, next) => {
  try {
    const placeId = Number(req.params.placeId)
    const { level } = req.body

    if (!Number.isInteger(placeId)) return res.status(404).json({ error: 'Place not found' })
    if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Crowd level must be quiet, moderate or packed' })

    const place = await placeModel.findByID(placeId)
    if (!place) return res.status(404).json({ error: 'Place not found' })
    if (closureStatusOf(place) !== 'normal') {
      return res.status(400).json({ error: 'This place is closed, so there is no crowd to report' })
    }

    const saved = await checkinModel.report(req.userId, placeId, level)
    res.status(201).json({ message: 'Thanks for the report', level: saved.level, at: saved.createdAt })
  } catch (e) {
    next(e)
  }
}
