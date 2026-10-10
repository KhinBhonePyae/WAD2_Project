const userModel = require('../models/user-model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')

/* POST /users/register */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email and password are required'
      });
    }

    // Check whether email is already registered
    const existingUser = await userModel.findByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        error: 'Email is already registered'
      });
    }

    // Hash password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userModel.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword
    });

    // Never send the password back to the browser
    const user = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      preferences: newUser.preferences
    };

    res.status(201).json({
      message: 'Account created successfully',
      user
    });

  } catch (e) {
    next(e);
  }
};

/* POST /users/login */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      })
    }

    const user = await userModel.findByEmail(email)

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
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
exports.getProfile = async (req, res, next) => {
  try {
    const user = await userModel.findByID(req.userId)

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
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, preferences } = req.body

    if (!name) {
      return res.status(400).json({
        error: 'Name is required'
      })
    }

    const updatedUser = await userModel.updateUser(req.userId, {
      name: name.trim(),
      preferences
    })

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
    next(e)
  }
}

/* DELETE /users/profile */
exports.deleteAccount = async (req, res, next) => {
  try {
    const deletedUser = await userModel.deleteUser(req.userId)

    if (!deletedUser) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    res.json({
      message: 'Account deleted successfully'
    })
  } catch (e) {
    next(e)
  }
}