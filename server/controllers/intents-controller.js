const intentModel = require('../models/intent-model')
const placeModel = require('../models/place-model')
const { slotsForPlace, isUpcoming, packedLevel } = require('../utils/slots')

function countFor(intents, placeId, date, slot) {
  return intents.filter(i => i.placeId === placeId && i.date === date && i.slot === slot).length
}

/* Each place's next open slot, used by GET /places and GET /places/:id.
 * Returns { [placeId]: { day, label, count, level } } for places with intents. */
exports.nextSlotSummary = async (places) => {
  const intents = await intentModel.findAllLive()
  const result = {}

  for (const p of places) {
    const next = slotsForPlace(p)[0]
    if (!next) continue
    const count = countFor(intents, p.id, next.date, next.slot)
    if (count) {
      result[p.id] = { day: next.day, label: next.label, count, level: packedLevel(count, p.capacity) }
    }
  }
  return result
}

/* GET /intents/place/:placeId - counts for every upcoming slot (public) */
exports.getPlaceIntents = async (req, res, next) => {
  try {
    const placeId = Number(req.params.placeId)
    const place = await placeModel.findByID(placeId)
    if (!place) return res.status(404).json({ error: 'Place not found' })

    const intents = await intentModel.findByPlace(placeId)
    const slots = slotsForPlace(place).map(s => {
      const count = countFor(intents, placeId, s.date, s.slot)
      return { ...s, count, level: packedLevel(count, place.capacity) }
    })

    res.json({ placeId, capacity: place.capacity || null, slots })
  } catch (e) {
    next(e)
  }
}

/* GET /intents/mine - the logged-in user's upcoming intents */
exports.getMyIntents = async (req, res, next) => {
  try {
    const intents = await intentModel.findByUser(req.userId)
    res.json({
      intents: intents.map(i => ({ placeId: i.placeId, date: i.date, slot: i.slot }))
    })
  } catch (e) {
    next(e)
  }
}

/* POST /intents/:placeId  body: { date, slot } */
exports.addIntent = async (req, res, next) => {
  try {
    const placeId = Number(req.params.placeId)
    const { date, slot } = req.body

    if (!Number.isInteger(placeId)) return res.status(400).json({ error: 'Invalid place ID' })
    if (!date || !slot) return res.status(400).json({ error: 'Date and slot are required' })
    const place = await placeModel.findByID(placeId)
    if (!place) return res.status(404).json({ error: 'Place not found' })

    if (!isUpcoming(date, slot, place)) {
      return res.status(400).json({ error: 'Pick a time slot today or tomorrow when this place is open' })
    }

    const existing = await intentModel.findIntent(req.userId, placeId, date, slot)
    if (existing) return res.json({ message: 'Already planning to go', placeId, date, slot })

    await intentModel.addIntent(req.userId, placeId, date, slot)
    res.status(201).json({ message: 'Intent added', placeId, date, slot })
  } catch (e) {
    // two quick clicks can race past findIntent; the unique index catches it
    if (e.code === 11000) {
      return res.json({ message: 'Already planning to go', placeId: Number(req.params.placeId) })
    }
    next(e)
  }
}

/* DELETE /intents/:placeId?date=YYYY-MM-DD&slot=morning */
exports.removeIntent = async (req, res, next) => {
  try {
    const placeId = Number(req.params.placeId)
    const { date, slot } = req.query

    if (!Number.isInteger(placeId)) return res.status(400).json({ error: 'Invalid place ID' })
    if (!date || !slot) return res.status(400).json({ error: 'Date and slot are required' })

    const removed = await intentModel.removeIntent(req.userId, placeId, date, slot)
    if (!removed) return res.status(404).json({ error: 'Intent not found' })

    res.json({ message: 'Intent removed', placeId, date, slot })
  } catch (e) {
    next(e)
  }
}
