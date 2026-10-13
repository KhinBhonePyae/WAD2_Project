// "Planning to go" intents (GET/POST/DELETE /intents).
import axios from 'axios'
import { BASE_URL } from './api.js'

function authHeader() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
}

export const LEVEL_LABELS = { quiet: 'Likely quiet', filling: 'Filling up', packed: 'Likely packed' }
export const LEVEL_BADGES = { quiet: 'ss-badge--green', filling: 'ss-badge--amber', packed: 'ss-badge--pink' }

// Counts for every upcoming slot at one place (no login needed)
export async function fetchPlaceIntents(placeId) {
  const response = await axios.get(`${BASE_URL}/intents/place/${placeId}`)
  return response.data.slots
}

// The logged-in user's upcoming intents, or [] when logged out
export async function fetchMyIntents() {
  if (!localStorage.getItem('token')) return []
  try {
    const response = await axios.get(`${BASE_URL}/intents/mine`, authHeader())
    return response.data.intents
  } catch (e) {
    console.error('Could not load your plans', e)
    return []
  }
}

export async function addIntent(placeId, date, slot) {
  await axios.post(`${BASE_URL}/intents/${placeId}`, { date, slot }, authHeader())
}

export async function removeIntent(placeId, date, slot) {
  await axios.delete(`${BASE_URL}/intents/${placeId}`, { ...authHeader(), params: { date, slot } })
}
