/* Shared helpers for the server tests.
 * Tests run in mock mode (data/places.json, in-memory reviews and check-ins),
 * so they never touch MongoDB Atlas and leave no data behind. */
global.MOCK_MODE = true;

// A stand-in for Express's res: records the status code and JSON body
function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// Call a controller like Express would; a thrown error fails the test
async function call(handler, { params = {}, body = {}, query = {}, userId } = {}) {
  const res = fakeRes();
  await handler({ params, body, query, userId }, res, (err) => { throw err; });
  return res;
}

module.exports = { call };
