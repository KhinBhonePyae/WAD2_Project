/* OneMap access token, refreshed automatically.
 * OneMap tokens only last 3 days. With ONEMAP_EMAIL and ONEMAP_PASSWORD in
 * config.env, the server asks OneMap for a new token whenever the current one
 * is missing or close to expiring, so directions keep working without anyone
 * pasting in a new token. Without them it falls back to a fixed ONEMAP_TOKEN.
 * Docs: https://www.onemap.gov.sg/apidocs/authentication */
const axios = require('axios');

const TOKEN_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
const REFRESH_EARLY_MS = 60 * 60 * 1000; // get a new token an hour before the old one runs out

let cached = null;      // { token, expiresAt }
let pending = null;     // the refresh request in progress, shared by requests that arrive together

// When a token expires, read from the "exp" field inside the token itself
function expiryOf(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function requestNewToken() {
  const { data } = await axios.post(TOKEN_URL, {
    email: process.env.ONEMAP_EMAIL,
    password: process.env.ONEMAP_PASSWORD
  }, { timeout: 10000 });

  if (!data.access_token) throw new Error('OneMap did not return a token.');
  const expiresAt = Number(data.expiry_timestamp) * 1000 || expiryOf(data.access_token) || Date.now() + REFRESH_EARLY_MS;
  console.log(`OneMap token refreshed, valid until ${new Date(expiresAt).toISOString()}`);
  return { token: data.access_token, expiresAt };
}

/* The token to send to OneMap, or null when OneMap is not set up. */
async function getOneMapToken() {
  const canRefresh = process.env.ONEMAP_EMAIL && process.env.ONEMAP_PASSWORD;

  if (!canRefresh) return process.env.ONEMAP_TOKEN || null;
  if (cached && cached.expiresAt - Date.now() > REFRESH_EARLY_MS) return cached.token;

  if (!pending) {
    pending = requestNewToken()
      .then(result => { cached = result; return result.token; })
      .finally(() => { pending = null; });
  }
  return pending;
}

/* Forget the cached token, e.g. after OneMap rejects it, so the next call gets a fresh one. */
function clearOneMapToken() {
  cached = null;
}

/* True when directions can work: either an account to refresh with, or a fixed token. */
function isOneMapConfigured() {
  return Boolean((process.env.ONEMAP_EMAIL && process.env.ONEMAP_PASSWORD) || process.env.ONEMAP_TOKEN);
}

module.exports = { getOneMapToken, clearOneMapToken, isOneMapConfigured };
