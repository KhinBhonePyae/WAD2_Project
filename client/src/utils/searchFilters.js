// Filter preferences + client-side filtering for the search page.
// Scoring itself lives in utils/suitability.js (single source of truth).

import { preferencesToWanted } from './suitability'

export const DEFAULT_PREFS = {
  facilities: [],          // wanted facility slugs, passed to suitabilityScore as `wanted`
  strictFacilities: false, // true = hide places that lack any selected facility (server-side)
  area: '',                // server-side
  minRating: 0,            // server-side
  openNowOnly: false,      // client-side
  setting: 'any',          // 'any' | 'indoor' | 'outdoor'   (client-side)
  maxCrowd: 'any',         // 'any' | 'moderate' | 'quiet'   (client-side)
}

const CROWD_RANK = { quiet: 1, moderate: 2, packed: 3 }

// Places without crowd reports (no crowdLevel) are never hidden by the crowd filter.
export function filterPlaces(list, prefs) {
  return list.filter((p) => {
    if (prefs.openNowOnly && !p.openNow) return false
    if (prefs.setting === 'indoor' && !p.indoor) return false
    if (prefs.setting === 'outdoor' && p.indoor) return false
    if (prefs.maxCrowd !== 'any') {
      const rank = CROWD_RANK[p.crowdLevel]
      if (rank && rank > CROWD_RANK[prefs.maxCrowd]) return false
    }
    return true
  })
}

//For autoselect from preferences to search page

export function prefsFromUserPreferences(preferences = {}) {
  const wanted = preferencesToWanted(preferences)
  const facilities = wanted.filter((f) => f !== 'indoor')
  const out = {}

  if (facilities.length) {
    out.facilities = facilities
    // "Required" flags → server-side strict filtering.
    // "Preferred" flags alone stay soft, so scoring can still reward partial matches.
    out.strictFacilities = !!(preferences.wifiRequired || preferences.socketsRequired)
  }

  if (wanted.includes('indoor')) out.setting = 'indoor'

  return out
}