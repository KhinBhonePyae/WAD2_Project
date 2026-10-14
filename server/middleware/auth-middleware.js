const jwt = require('jsonwebtoken')
const userModel = require('../models/user-model')

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await userModel.findByID(decoded.userId)

    if (!user) return res.status(401).json({ error: 'User no longer exists' })

    req.userId = user._id
    req.user = user
    req.userRole = user.role || 'user'

    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = authenticate