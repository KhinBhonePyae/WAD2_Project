const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const { call } = require('./helpers')
const userModel = require('../models/user-model')
const usersController = require('../controllers/users-controller')

/* Password reset tests.
 * These use mock mode, so no MongoDB data or real reset emails are created. */

test('forgot password rejects an invalid email', async () => {
  const res = await call(usersController.forgotPassword, {
    body: { email: 'not-an-email' }
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Enter a valid email address')
})

test('forgot password gives a generic response for an unknown email', async () => {
  const res = await call(usersController.forgotPassword, {
    body: { email: 'nobody@example.test' }
  })

  assert.equal(res.statusCode, 200)
  assert.equal(
    res.body.message,
    'If an account exists for this email, a password reset link has been sent.'
  )
})

test('reset password rejects passwords that do not match', async () => {
  const res = await call(usersController.resetPassword, {
    params: { token: 'anything' },
    body: {
      newPassword: 'new-password-123',
      confirmPassword: 'different-password-123'
    }
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Passwords do not match')
})

test('reset password rejects a password shorter than 8 characters', async () => {
  const res = await call(usersController.resetPassword, {
    params: { token: 'anything' },
    body: {
      newPassword: 'short',
      confirmPassword: 'short'
    }
  })

  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /at least 8 characters/)
})

test('reset password rejects an invalid token', async () => {
  const res = await call(usersController.resetPassword, {
    params: { token: 'invalid-token' },
    body: {
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123'
    }
  })

  assert.equal(res.statusCode, 400)
  assert.equal(
    res.body.error,
    'Password reset link is invalid or has expired'
  )
})

test('reset password rejects an expired token', async () => {
  const stamp = Date.now()
  const rawToken = `expired-token-${stamp}`

  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex')

  await userModel.createUser({
    name: 'Expired Token Test',
    email: `expired-${stamp}@example.test`,
    password: await bcrypt.hash('old-password-123', 10),
    resetPasswordToken: hashedToken,
    resetPasswordExpires: new Date(Date.now() - 60000)
  })

  const res = await call(usersController.resetPassword, {
    params: { token: rawToken },
    body: {
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123'
    }
  })

  assert.equal(res.statusCode, 400)
  assert.equal(
    res.body.error,
    'Password reset link is invalid or has expired'
  )
})

test('reset password changes the password when the token is valid', async () => {
  const stamp = Date.now()
  const oldPassword = 'old-password-123'
  const newPassword = 'new-password-123'
  const rawToken = `valid-token-${stamp}`

  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex')

  const user = await userModel.createUser({
    name: 'Password Reset Test',
    email: `password-reset-${stamp}@example.test`,
    password: await bcrypt.hash(oldPassword, 10),
    resetPasswordToken: hashedToken,
    resetPasswordExpires: new Date(Date.now() + 60000)
  })

  const res = await call(usersController.resetPassword, {
    params: { token: rawToken },
    body: {
      newPassword,
      confirmPassword: newPassword
    }
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.message, 'Password reset successfully')

  const updatedUser = await userModel.findByID(user._id)

  assert.equal(
    await bcrypt.compare(newPassword, updatedUser.password),
    true
  )

  assert.equal(
    await bcrypt.compare(oldPassword, updatedUser.password),
    false
  )

  assert.equal(updatedUser.resetPasswordToken, null)
  assert.equal(updatedUser.resetPasswordExpires, null)
})

test('reset password does not allow the current password to be reused', async () => {
  const stamp = Date.now()
  const currentPassword = 'current-password-123'
  const rawToken = `same-password-token-${stamp}`

  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex')

  await userModel.createUser({
    name: 'Same Password Test',
    email: `same-password-${stamp}@example.test`,
    password: await bcrypt.hash(currentPassword, 10),
    resetPasswordToken: hashedToken,
    resetPasswordExpires: new Date(Date.now() + 60000)
  })

  const res = await call(usersController.resetPassword, {
    params: { token: rawToken },
    body: {
      newPassword: currentPassword,
      confirmPassword: currentPassword
    }
  })

  assert.equal(res.statusCode, 400)
  assert.equal(
    res.body.error,
    'New password must be different from the current password'
  )
})