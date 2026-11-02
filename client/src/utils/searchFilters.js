import { preferencesToWanted } from './suitability'

export const DEFAULT_PREFS = {
  facilities: [],
  strictFacilities: false,
  area: '',
  minRating: 0,
  openNowOnly: false,
  freeEntryOnly: false,
  setting: 'any',
  maxCrowd: 'any',
  nearbyOnly: false,
  radiusKm: 2,
  userLocation: null,
}

// UPDATED: Removed 5 km and 10 km
export const RADIUS_OPTIONS = [
  { value: 0.5, label: '500 m' },
  { value: 1,   label: '1 km' },
  { value: 2,   label: '2 km' },
]

const CROWD_RANK = { quiet: 1, moderate: 2, packed: 3 }
const EARTH_RADIUS_KM = 6371

function coords(loc) {
  if (!loc) return null
  const lat = Number(loc.lat ?? loc.latitude)
  const lng = Number(loc.lng ?? loc.lon ?? loc.longitude)
  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

export function distanceKm(a, b) {
  const p1 = coords(a)
  const p2 = coords(b)
  if (!p1 || !p2) return Infinity

  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(p2.lat - p1.lat)
  const dLng = toRad(p2.lng - p1.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function placeCoords(place) {
  if (!place) return null
  if (Array.isArray(place.location?.coordinates) && place.location.coordinates.length === 2) {
    const [lng, lat] = place.location.coordinates
    return coords({ lat, lng })
  }
  return coords(place)
}

export function isWithinRadius(place, userLocation, radiusKm) {
  const user = coords(userLocation)
  if (!user) return true 
  const placeLoc = placeCoords(place)
  if (!placeLoc) return false
  return distanceKm(user, placeLoc) <= radiusKm
}

export function filterPlaces(list, prefs) {
  const nearbyOnly = !!prefs.nearbyOnly
  const radius = Number(prefs.radiusKm) > 0 ? Number(prefs.radiusKm) : DEFAULT_PREFS.radiusKm
  const userLoc = coords(prefs.userLocation)

  return list.filter((p) => {
    if (nearbyOnly && userLoc && !isWithinRadius(p, userLoc, radius)) return false

    if (prefs.openNowOnly && !p.openNow) return false
    if (prefs.freeEntryOnly && p.entry !== 'free') return false
    if (prefs.setting === 'indoor' && !p.indoor) return false
    if (prefs.setting === 'outdoor' && p.indoor) return false
    if (prefs.maxCrowd !== 'any') {
      const rank = CROWD_RANK[p.crowdLevel]
      if (rank && rank > CROWD_RANK[prefs.maxCrowd]) return false
    }
    return true
  })
}

export function sortByDistance(list, userLocation) {
  const user = coords(userLocation)
  if (!user) return list
  return [...list].sort((a, b) => {
    const da = placeCoords(a) ? distanceKm(user, placeCoords(a)) : Infinity
    const db = placeCoords(b) ? distanceKm(user, placeCoords(b)) : Infinity
    return da - db
  })
}

export function prefsFromUserPreferences(preferences = {}) {
  const wanted = preferencesToWanted(preferences)
  const facilities = wanted.filter((f) => f !== 'indoor')
  const out = {}

  if (facilities.length) {
    out.facilities = facilities
    out.strictFacilities = !!(preferences.wifiRequired || preferences.socketsRequired)
  }

  if (wanted.includes('indoor')) out.setting = 'indoor'

  return out
}