/* Suitability score - PROTOTYPE FORMULA.
 *
 * Owner: Gerena Lim (search, advanced filters and suitability scoring).
 * This is a transparent weighted sum, deliberately simple so it can be
 * explained in one slide at the pitch. Tune the weights, do not replace
 * it with something opaque.
 *
 *   facilities match   0-50   fraction of the user's required facilities present
 *   open now           0-15
 *   crowd level        0-20   quiet 20 / moderate 10 / packed 0
 *   star rating        0-15   rating / 5 * 15
 *   weather modifier  -25-+10 outdoor places only
 */

export const FACILITY_LABELS = {
  wifi: 'Wi-Fi', sockets: 'Sockets', fnb: 'F&B', water: 'Water', toilets: 'Toilets', quiet: 'Quiet',
}

// Same formula as before, but also returns human-readable reasons for the search page.
export function suitabilityBreakdown(place, wanted = [], weather = null) {
  let score = 0
  const reasons = []
  const have = place.facilities || []

  if (wanted.length === 0) {
    score += 35                                    // no stated needs: neutral baseline
  } else {
    const hits = wanted.filter(f => have.includes(f)).length
    score += (hits / wanted.length) * 50
    const missing = wanted.filter(f => !have.includes(f))
    reasons.push(missing.length
      ? `Missing: ${missing.map(f => FACILITY_LABELS[f] || f).join(', ')}`
      : 'Has all your facilities')
  }

  if (place.openNow) { score += 15; reasons.push('Open now') }
  else reasons.push('Closed right now')

  if (place.crowdLevel === 'quiet') { score += 20; reasons.push('Quiet right now') }
  else if (place.crowdLevel === 'moderate') { score += 10; reasons.push('Moderately busy') }
  else if (place.crowdLevel === 'packed') reasons.push('Packed right now')

  score += (Number(place.rating) || 0) / 5 * 15

  if (!place.indoor && weather) {
    if (weather.raining) { score -= 25; reasons.push('Outdoor - rain lowers the score') }
    else if (weather.fair) { score += 10; reasons.push('Outdoor - fine weather helps') }
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons }
}

export function suitabilityScore(place, wanted = [], weather = null) {
  return suitabilityBreakdown(place, wanted, weather).score
}

export function scoreBand(score) {
  if (score >= 75) return 'high'
  if (score >= 45) return 'mid'
  return 'low'
}