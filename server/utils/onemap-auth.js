const axios = require('axios');

const TOKEN_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
const TOKEN_LIFETIME_MS = 72 * 60 * 60 * 1000;
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

let cachedToken = null;
let tokenExpiry = 0;
let tokenRequest = null;

async function requestOneMapToken(email, password) {
  const { data } = await axios.post(TOKEN_URL, { email, password }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 8000
  });

  if (!data?.access_token) {
    throw new Error('OneMap authentication did not return an access token.');
  }

  const reportedExpiry = Date.parse(data.expiry_timestamp);
  tokenExpiry = Number.isFinite(reportedExpiry)
    ? reportedExpiry - EXPIRY_BUFFER_MS
    : Date.now() + TOKEN_LIFETIME_MS - EXPIRY_BUFFER_MS;
  cachedToken = data.access_token;

  return cachedToken;
}

function getOneMapToken() {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;

  if (Boolean(email) !== Boolean(password)) {
    const error = new Error('Set both ONEMAP_EMAIL and ONEMAP_PASSWORD to enable OneMap authentication.');
    error.status = 503;
    throw error;
  }

  if (!email && !password) {
    if (process.env.ONEMAP_TOKEN) return Promise.resolve(process.env.ONEMAP_TOKEN);

    const error = new Error('OneMap is not configured on the server.');
    error.status = 503;
    throw error;
  }

  if (cachedToken && Date.now() < tokenExpiry) {
    return Promise.resolve(cachedToken);
  }

  if (!tokenRequest) {
    tokenRequest = requestOneMapToken(email, password)
      .catch(error => {
        const authError = new Error(
          error.response
            ? `OneMap authentication failed (HTTP ${error.response.status}).`
            : `OneMap authentication failed: ${error.message}`
        );
        authError.status = 503;
        throw authError;
      })
      .finally(() => {
        tokenRequest = null;
      });
  }

  return tokenRequest;
}

async function withOneMapToken(request) {
  const token = await getOneMapToken();

  try {
    return await request(token);
  } catch (error) {
    if (
      error.response?.status !== 401 ||
      !process.env.ONEMAP_EMAIL ||
      !process.env.ONEMAP_PASSWORD
    ) {
      throw error;
    }

    if (cachedToken === token) {
      cachedToken = null;
      tokenExpiry = 0;
    }

    return request(await getOneMapToken());
  }
}

module.exports = { getOneMapToken, withOneMapToken };
