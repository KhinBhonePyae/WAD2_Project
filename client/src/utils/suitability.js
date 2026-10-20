/* Suitability score - PROTOTYPE FORMULA.
 *
 * Owner: Gerena Lim (search, advanced filters and suitability scoring).
 * Personalized preference integration keeps the same transparent weighted formula.
 *
 *   preference match   0-50
 *   open now           0-15
 *   crowd level        0-20
 *   star rating        0-15
 *   weather modifier  -25-+10
 *   planned visits    -10-0
 */

export const FACILITY_LABELS = {
  wifi: 'Wi-Fi', sockets: 'Power sockets', fnb: 'Food & drink', water: 'Water dispenser', toilets: 'Toilets', quiet: 'Quiet environment', indoor: 'Indoor location'
}

export function preferencesToWanted(preferences = {}) {
  const wanted = []
  if (preferences.wifiRequired) wanted.push('wifi')
  if (preferences.socketsRequired) wanted.push('sockets')
  if (preferences.quietPreferred) wanted.push('quiet')
  if (preferences.indoorPreferred) wanted.push('indoor')
  return wanted
}

export function closureStatusOf(place = {}) {
  const hours = (place.hours || '').toLowerCase()
  if (place.closureStatus === 'permanent' || hours.includes('permanent')) return 'permanent'
  if (place.closureStatus === 'temporary' || hours.includes('renovation') || hours.includes('temporar')) return 'temporary'
  return 'normal'
}

function matchesPreference(place, preference) {
  if (preference === 'indoor') return !!place.indoor
  return (place.facilities || []).includes(preference)
}

export function suitabilityBreakdown(place, wanted = [], weather = null) {
  const closureStatus = closureStatusOf(place)
  if (closureStatus === 'permanent') return { score: 0, reasons: ['Permanently closed'] }
  if (closureStatus === 'temporary') return { score: 0, reasons: ['Temporarily closed'] }

  let score = 0
  const reasons = []

  if (wanted.length === 0) {
    score += 35
  } else {
    const matched = wanted.filter(preference => matchesPreference(place, preference))
    const missing = wanted.filter(preference => !matchesPreference(place, preference))
    score += (matched.length / wanted.length) * 50
    if (matched.length) reasons.push(`Matches: ${matched.map(preference => FACILITY_LABELS[preference] || preference).join(', ')}`)
    if (missing.length) reasons.push(`Missing: ${missing.map(preference => FACILITY_LABELS[preference] || preference).join(', ')}`)
  }

  if (place.openNow) { score += 15; reasons.push('Open now') }
  else reasons.push('Closed right now')

  // crowd comes from the latest review, which may be a few days old, so say "last reported"
  if (place.crowdLevel === 'quiet') { score += 20; reasons.push('Last reported quiet') }
  else if (place.crowdLevel === 'moderate') { score += 10; reasons.push('Last reported moderately busy') }
  else if (place.crowdLevel === 'packed') reasons.push('Last reported packed')

  score += (Number(place.rating) || 0) / 5 * 15

  if (place.intent?.level === 'packed') { score -= 10; reasons.push('Many people planning to go') }
  else if (place.intent?.level === 'filling') { score -= 5; reasons.push('Some people planning to go') }

  if (!place.indoor && weather) {
    if (weather.raining) { score -= 25; reasons.push('Outdoor - rain lowers the score') }
    else if (weather.fair) { score += 10; reasons.push('Outdoor - fine weather helps') }
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  if (!place.openNow) score = Math.min(score, 45)

  return { score, reasons }
}

export function suitabilityScore(place, wanted = [], weather = null) {
  return suitabilityBreakdown(place, wanted, weather).score
}

export function scoreBand(score) {
  if (score >= 75) return 'high'
  if (score >= 45) return 'mid'
  return 'low'
}
