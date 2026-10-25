/* The login guard in front of every write route (reviews, check-ins, saved places...).
 * Run with: pnpm test */
require('./helpers');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth-middleware');
const userModel = require('../models/user-model');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Runs the middleware and reports whether it let the request through
async function guard(authorization) {
  const req = { headers: authorization ? { authorization } : {} };
  let status = null;
  let passed = false;
  const res = { status(code) { status = code; return this; }, json() { return this; } };
  await authenticate(req, res, () => { passed = true; });
  return { passed, status, req };
}

describe('auth middleware', () => {
  test('refuses a request with no token', async () => {
    const { passed, status } = await guard();
    assert.equal(passed, false);
    assert.equal(status, 401);
  });

  test('refuses a header that is not "Bearer <token>"', async () => {
    assert.equal((await guard('Token abc')).status, 401);
  });

  test('refuses a forged or broken token', async () => {
    const forged = jwt.sign({ userId: 'someone' }, 'not-the-real-secret');
    assert.equal((await guard('Bearer ' + forged)).status, 401);
    assert.equal((await guard('Bearer not-a-jwt')).status, 401);
  });

  test('refuses a valid token for an account that no longer exists', async () => {
    const original = userModel.findByID;
    userModel.findByID = async () => null;
    try {
      const token = jwt.sign({ userId: 'deleted-user' }, process.env.JWT_SECRET);
      assert.equal((await guard('Bearer ' + token)).status, 401);
    } finally {
      userModel.findByID = original;
    }
  });

  test('lets a valid token through and attaches the user', async () => {
    const original = userModel.findByID;
    userModel.findByID = async (id) => ({ _id: id, name: 'Test User', role: 'user' });
    try {
      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);
      const { passed, req } = await guard('Bearer ' + token);
      assert.equal(passed, true);
      assert.equal(req.userId, 'user-1');
      assert.equal(req.userRole, 'user');
    } finally {
      userModel.findByID = original;
    }
  });
});
