const userModel = require('../models/user-model')
const savedModel = require('../models/saved-model')
const intentModel = require('../models/intent-model')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

/* POST /users/register */
exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password
    } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        error:
          'Name, email and password are required'
      })
    }

    const cleanEmail =
      email.trim().toLowerCase()

    const existingUser =
      await userModel.findByEmail(cleanEmail)

    if (existingUser) {
      return res.status(409).json({
        error: 'Email is already registered'
      })
    }

    const hashedPassword =
      await bcrypt.hash(password, 10)

    const newUser =
      await userModel.createUser({
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword
      })

    const user = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      preferences: newUser.preferences
    }

    res.status(201).json({
      message: 'Account created successfully',
      user
    })
  } catch (e) {
    next(e)
  }
}

/* POST /users/login */
exports.login = async (req, res, next) => {
  try {
    const {
      email,
      password
    } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      })
    }

    const user = await userModel.findByEmail(
      email.trim().toLowerCase()
    )

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      )

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    const token = jwt.sign(
      {
        userId: user._id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    )

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    })
  } catch (e) {
    next(e)
  }
}

/* GET /users/profile */
exports.getProfile = async (
  req,
  res,
  next
) => {
  try {
    const user =
      await userModel.findByID(req.userId)

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      preferences: user.preferences
    })
  } catch (e) {
    next(e)
  }
}

/* PUT /users/profile */
exports.updateProfile = async (
  req,
  res,
  next
) => {
  try {
    const {
      name,
      email,
      preferences
    } = req.body

    if (!name || !email) {
      return res.status(400).json({
        error: 'Name and email are required'
      })
    }

    const currentUser =
      await userModel.findByID(req.userId)

    if (!currentUser) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    const cleanEmail =
      email.trim().toLowerCase()

    if (cleanEmail !== currentUser.email) {
      const existingUser =
        await userModel.findByEmail(cleanEmail)

      if (existingUser) {
        return res.status(409).json({
          error: 'Email is already registered'
        })
      }
    }

    const updatedUser =
      await userModel.updateUser(
        req.userId,
        {
          name: name.trim(),
          email: cleanEmail,
          preferences
        }
      )

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        preferences: updatedUser.preferences
      }
    })
  } catch (e) {
    /*
     * MongoDB duplicate key error.
     * This is an extra safeguard in case two
     * requests try to use the same email.
     */
    if (e.code === 11000) {
      return res.status(409).json({
        error: 'Email is already registered'
      })
    }

    next(e)
  }
}

/* PUT /users/profile/password */
exports.changePassword = async (
  req,
  res,
  next
) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        error:
          'All password fields are required'
      })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'New passwords do not match'
      })
    }

    const user =
      await userModel.findByID(req.userId)

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    const passwordMatch =
      await bcrypt.compare(
        currentPassword,
        user.password
      )

    if (!passwordMatch) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      })
    }

    const samePassword =
      await bcrypt.compare(
        newPassword,
        user.password
      )

    if (samePassword) {
      return res.status(400).json({
        error:
          'New password must be different from the current password'
      })
    }

    const hashedPassword =
      await bcrypt.hash(newPassword, 10)

    await userModel.updateUser(
      req.userId,
      {
        password: hashedPassword
      }
    )

    res.json({
      message: 'Password changed successfully'
    })
  } catch (e) {
    next(e)
  }
}

/* DELETE /users/profile */
exports.deleteAccount = async (
  req,
  res,
  next
) => {
  try {
    const deletedUser =
      await userModel.deleteUser(req.userId)

    if (!deletedUser) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    // remove the deleted user's saved places too
    await savedModel.deleteAllForUser(req.userId)
    await intentModel.deleteAllForUser(req.userId)

    res.json({
      message: 'Account deleted successfully'
    })
  } catch (e) {
    next(e)
  }
}