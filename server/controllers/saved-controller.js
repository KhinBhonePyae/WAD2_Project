const savedModel = require('../models/saved-model')
const placeModel = require('../models/place-model')

exports.getSavedPlaces = async (req, res, next) => {
  try {
    const savedPlaces = await savedModel.getSavedByUser(req.userId)
    const savedPlaceIds = savedPlaces.map(item => item.placeId)

    res.json({ savedPlaceIds })
  } catch (e) {
    next(e)
  }
}

exports.savePlace = async (req, res, next) => {
  try {
    const placeId = Number(req.params.placeId)

    if (!Number.isInteger(placeId)) {
      return res.status(400).json({
        error: 'Invalid place ID'
      })
    }

    const place = await placeModel.findByID(placeId)

    if (!place) {
      return res.status(404).json({
        error: 'Place not found'
      })
    }

    const existing = await savedModel.findSaved(
      req.userId,
      placeId
    )

    if (existing) {
      return res.json({
        message: 'Place already saved',
        placeId
      })
    }

    await savedModel.addSaved(req.userId, placeId)

    res.status(201).json({
      message: 'Place saved',
      placeId
    })
  } catch (e) {
    if (e.code === 11000) {
      return res.json({
        message: 'Place already saved',
        placeId: Number(req.params.placeId)
      })
    }

    next(e)
  }
}

exports.removeSavedPlace = async (req, res, next) => {
  try {
    const placeId = Number(req.params.placeId)

    if (!Number.isInteger(placeId)) {
      return res.status(400).json({
        error: 'Invalid place ID'
      })
    }

    const removed = await savedModel.removeSaved(
      req.userId,
      placeId
    )

    if (!removed) {
      return res.status(404).json({
        error: 'Saved place not found'
      })
    }

    res.json({
      message: 'Place removed from saved',
      placeId
    })
  } catch (e) {
    next(e)
  }
}