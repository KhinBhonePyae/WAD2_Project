/* The kinds of study spot a user can prefer at sign-up (preferences.studySpots).
 * They never hide places: they only move matching places to the front. */

export const STUDY_SPOTS = [
  { key: 'indoor', label: 'Indoor', emoji: '🏢', note: 'Air-con, walls, no weather' },
  { key: 'outdoor', label: 'Outdoor', emoji: '🌳', note: 'Terraces and fresh air' },
  { key: 'cafe', label: 'Café', emoji: '☕', note: 'Coffee and a bit of buzz' },
  { key: 'library', label: 'Library', emoji: '📚', note: 'Quiet shelves, free seats' },
]

const CAFE_TYPES = ['cafe', 'coffee_shop', 'coffee_roastery', 'coffee_stand', 'tea_house', 'bakery']

export function isSpot(place, key) {
  if (key === 'indoor') return !!place.indoor
  if (key === 'outdoor') return !place.indoor || (place.tags || []).includes('Outdoor')
  if (key === 'cafe') return CAFE_TYPES.includes(place.placeType)
  if (key === 'library') return !!place.branchCode || place.placeType === 'library' || /library/i.test(place.name || '')
  return false
}

// How many of the user's preferred kinds this place is
export function spotMatches(place, spots = []) {
  return spots.filter(key => isSpot(place, key))
}

// Places matching more preferred kinds first; otherwise the order is kept
export function orderBySpots(list, spots = []) {
  if (!spots.length) return list
  return list
    .map((place, index) => ({ place, index, matches: spotMatches(place, spots).length }))
    .sort((a, b) => b.matches - a.matches || a.index - b.index)
    .map(item => item.place)
}

export function spotLabels(keys = []) {
  return STUDY_SPOTS.filter(spot => keys.includes(spot.key)).map(spot => spot.label)
}
