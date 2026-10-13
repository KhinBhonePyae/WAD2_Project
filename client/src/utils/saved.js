// Saved places on the server (GET/POST/DELETE /saved), shared by the
// Home and Browse pages. Needs a logged-in user's token.
import axios from 'axios'
import { BASE_URL } from './api.js'

function authHeader() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
}

export function isLoggedIn() {
  return !!localStorage.getItem('token')
}

// Returns the saved place ids, or [] when logged out or on error
export async function fetchSavedIds() {
  if (!isLoggedIn()) return []
  try {
    const response = await axios.get(`${BASE_URL}/saved`, authHeader())
    return response.data.savedPlaceIds
  } catch (e) {
    console.error('Could not load saved places', e)
    return []
  }
}

// Saves or unsaves a place on the server and returns the new id list
export async function toggleSavedId(savedIds, placeId) {
  if (savedIds.includes(placeId)) {
    await axios.delete(`${BASE_URL}/saved/${placeId}`, authHeader())
    return savedIds.filter(id => id !== placeId)
  }
  await axios.post(`${BASE_URL}/saved/${placeId}`, {}, authHeader())
  return [...savedIds, placeId]
}
