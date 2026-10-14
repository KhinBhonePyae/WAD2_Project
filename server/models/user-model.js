/* User model + data-access helpers.
 * Handles user accounts, profiles and study preferences.
 */
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true },

  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  preferences: {
    wifiRequired: { type: Boolean, default: false },
    socketsRequired: { type: Boolean, default: false },
    quietPreferred: { type: Boolean, default: false },
    indoorPreferred: { type: Boolean, default: false }
  },

  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false })

const User = mongoose.model('User', userSchema, 'users')

// --- mock-mode store --------------------------------------------------
let mem = []
let nextId = 1

// Create user
exports.createUser = async (data) => {
  if (global.MOCK_MODE) {
    const user = {
      _id: 'u' + (nextId++),
      ...data,
      email: data.email.toLowerCase(),
      role: data.role || 'user',
      preferences: data.preferences || {
        wifiRequired: false,
        socketsRequired: false,
        quietPreferred: false,
        indoorPreferred: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mem.push(user)
    return user
  }

  return User.create(data)
}

// Find user by email
exports.findByEmail = async (email) => {
  if (global.MOCK_MODE) return mem.find(user => user.email === email.toLowerCase()) || null
  return User.findOne({ email: email.toLowerCase() })
}

// Find user by ID
exports.findByID = async (id) => {
  if (global.MOCK_MODE) return mem.find(user => user._id === id) || null
  return User.findById(id)
}

// Update user
exports.updateUser = async (id, data) => {
  if (global.MOCK_MODE) {
    const user = mem.find(user => user._id === id)
    if (!user) return null

    Object.assign(user, data, { updatedAt: new Date() })
    return user
  }

  return User.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true, runValidators: true })
}

// Delete user
exports.deleteUser = async (id) => {
  if (global.MOCK_MODE) {
    const index = mem.findIndex(user => user._id === id)
    if (index === -1) return null
    return mem.splice(index, 1)[0]
  }

  return User.findByIdAndDelete(id)
}

exports.User = User