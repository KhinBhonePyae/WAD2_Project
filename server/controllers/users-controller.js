const userModel = require('../models/user-model')
const savedModel = require('../models/saved-model')
const intentModel = require('../models/intent-model')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

function userResponse(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    createdAt: user.createdAt,
    preferences: user.preferences
  }
}

const MIN_PASSWORD = 8

// Returns an error message, or null when the name/email are fine
function checkNameAndEmail(name, email) {
  if (typeof name !== 'string' || !name.trim()) return 'Name is required'
  if (name.trim().length > 60) return 'Name must be 60 characters or fewer'
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address'
  return null
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`
  return null
}

// Only the four known yes/no preferences are stored
function cleanPreferences(preferences) {
  return {
    wifiRequired: preferences?.wifiRequired === true,
    socketsRequired: preferences?.socketsRequired === true,
    quietPreferred: preferences?.quietPreferred === true,
    indoorPreferred: preferences?.indoorPreferred === true
  }
}

/* POST /users/register */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, preferences } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' })
    const invalid = checkNameAndEmail(name, email) || checkPassword(password)
    if (invalid) return res.status(400).json({ error: invalid })

    const cleanEmail = email.trim().toLowerCase()
    const existingUser = await userModel.findByEmail(cleanEmail)
    if (existingUser) return res.status(409).json({ error: 'Email is already registered' })

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await userModel.createUser({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: 'user',
      preferences: cleanPreferences(preferences)
    })

    res.status(201).json({ message: 'Account created successfully', user: userResponse(newUser) })
  } catch (e) {
    next(e)
  }
}

/* POST /users/login */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await userModel.findByEmail(email.trim().toLowerCase())
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' })
    res.json({ message: 'Login successful', token, user: userResponse(user) })
  } catch (e) {
    next(e)
  }
}

/* GET /users/profile */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await userModel.findByID(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(userResponse(user))
  } catch (e) {
    next(e)
  }
}

/* PUT /users/profile */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, preferences } = req.body
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' })
    const invalid = checkNameAndEmail(name, email)
    if (invalid) return res.status(400).json({ error: invalid })

    const currentUser = await userModel.findByID(req.userId)
    if (!currentUser) return res.status(404).json({ error: 'User not found' })

    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail !== currentUser.email) {
      const existingUser = await userModel.findByEmail(cleanEmail)
      if (existingUser) return res.status(409).json({ error: 'Email is already registered' })
    }

    const updateData = { name: name.trim(), email: cleanEmail }
    if (preferences !== undefined) updateData.preferences = cleanPreferences(preferences)

    const updatedUser = await userModel.updateUser(req.userId, updateData)
    if (!updatedUser) return res.status(404).json({ error: 'User not found' })

    res.json({ message: 'Profile updated successfully', user: userResponse(updatedUser) })
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email is already registered' })
    next(e)
  }
}

/* PUT /users/profile/password */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body

    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: 'All password fields are required' })
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'New passwords do not match' })
    const weak = checkPassword(newPassword)
    if (weak) return res.status(400).json({ error: weak })

    const user = await userModel.findByID(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const passwordMatch = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatch) return res.status(400).json({ error: 'Current password is incorrect' })

    const samePassword = await bcrypt.compare(newPassword, user.password)
    if (samePassword) return res.status(400).json({ error: 'New password must be different from the current password' })

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await userModel.updateUser(req.userId, { password: hashedPassword })

    res.json({ message: 'Password changed successfully' })
  } catch (e) {
    next(e)
  }
}

/* DELETE /users/profile */
exports.deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body
    if (!password) return res.status(400).json({ error: 'Password is required' })

    const user = await userModel.findByID(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) return res.status(400).json({ error: 'Incorrect password' })

    if (user.role === 'admin') {
      const adminCount = await userModel.countAdmins()
      if (adminCount <= 1) return res.status(400).json({ error: 'The last admin account cannot be deleted' })
    }

    const deletedUser = await userModel.deleteUser(req.userId)
    if (!deletedUser) return res.status(404).json({ error: 'User not found' })

    await Promise.all([
      savedModel.deleteAllForUser(req.userId),
      intentModel.deleteAllForUser(req.userId)
    ])

    res.json({ message: 'Account deleted successfully' })
  } catch (e) {
    next(e)
  }
}

/* GET /users/admin */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await userModel.getAllUsers()
    res.json({ users: users.map(userResponse) })
  } catch (e) {
    next(e)
  }
}

/* PUT /users/admin/:id */
exports.updateUserByAdmin = async (req, res, next) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(400).json({ error: 'Edit your own name and email from My Profile instead' })
    }

    const { name, email } = req.body
    if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: 'Name and email are required' })
    const invalid = checkNameAndEmail(name, email)
    if (invalid) return res.status(400).json({ error: invalid })

    const targetUser = await userModel.findByID(req.params.id)
    if (!targetUser) return res.status(404).json({ error: 'User not found' })

    const cleanEmail = email.trim().toLowerCase()
    const existingUser = await userModel.findByEmail(cleanEmail)
    if (existingUser && String(existingUser._id) !== String(targetUser._id)) {
      return res.status(409).json({ error: 'Email is already registered' })
    }

    const updatedUser = await userModel.updateUser(req.params.id, { name: name.trim(), email: cleanEmail })
    res.json({ message: 'User updated successfully', user: userResponse(updatedUser) })
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email is already registered' })
    next(e)
  }
}

/* PUT /users/admin/:id/role */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' })

    if (String(req.userId) === String(req.params.id)) {
      return res.status(400).json({ error: 'You cannot change your own admin role here' })
    }

    const targetUser = await userModel.findByID(req.params.id)
    if (!targetUser) return res.status(404).json({ error: 'User not found' })

    if (targetUser.role === 'admin' && role === 'user') {
      const adminCount = await userModel.countAdmins()
      if (adminCount <= 1) return res.status(400).json({ error: 'The last admin cannot be changed to a normal user' })
    }

    const updatedUser = await userModel.updateUser(req.params.id, { role })
    res.json({ message: 'User role updated successfully', user: userResponse(updatedUser) })
  } catch (e) {
    next(e)
  }
}

/* DELETE /users/admin/:id */
exports.deleteUserByAdmin = async (req, res, next) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account from Admin Users' })
    }

    const targetUser = await userModel.findByID(req.params.id)
    if (!targetUser) return res.status(404).json({ error: 'User not found' })

    if (targetUser.role === 'admin') {
      const adminCount = await userModel.countAdmins()
      if (adminCount <= 1) return res.status(400).json({ error: 'The last admin account cannot be deleted' })
    }

    const deletedUser = await userModel.deleteUser(req.params.id)
    if (!deletedUser) return res.status(404).json({ error: 'User not found' })

    await Promise.all([savedModel.deleteAllForUser(req.params.id), intentModel.deleteAllForUser(req.params.id)])
    res.json({ message: `${deletedUser.name}'s account was deleted successfully` })
  } catch (e) {
    next(e)
  }
}
