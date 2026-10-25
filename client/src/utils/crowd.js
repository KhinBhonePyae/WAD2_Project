// Crowd reports (GET/POST /crowd): one-tap check-ins plus the crowd level in reviews.
import axios from 'axios'
import { BASE_URL } from './api.js'

export const CROWD_LABELS = { quiet: 'Quiet', moderate: 'Moderate', packed: 'Packed' }

// A report this recent counts as "right now"
export const FRESH_MS = 2 * 60 * 60 * 1000

function authHeader() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
}

// { latest: { level, at, source } | null, counts: { quiet, moderate, packed }, total }
export async function fetchPlaceCrowd(placeId) {
  const response = await axios.get(`${BASE_URL}/crowd/place/${placeId}`)
  return response.data
}

export async function checkIn(placeId, level) {
  const response = await axios.post(`${BASE_URL}/crowd/${placeId}`, { level }, authHeader())
  return response.data
}

// The logged-in user's own check-in from the last hour ('quiet' | ... | null)
export async function fetchMyCheckin(placeId) {
  if (!localStorage.getItem('token')) return null
  try {
    const response = await axios.get(`${BASE_URL}/crowd/mine/${placeId}`, authHeader())
    return response.data.level
  } catch {
    return null
  }
}

export async function undoCheckin(placeId) {
  await axios.delete(`${BASE_URL}/crowd/${placeId}`, authHeader())
}

export function isFresh(at, now = Date.now()) {
  const time = new Date(at).getTime()
  return !Number.isNaN(time) && now - time < FRESH_MS
}

// '5 min ago', '3 h ago', 'yesterday', '4 days ago', then a date
export function timeAgo(at, now = Date.now()) {
  const time = new Date(at).getTime()
  if (Number.isNaN(time)) return ''
  const minutes = Math.floor((now - time) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(time).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}
