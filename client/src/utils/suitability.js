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
export function suitabilityScore(place, wanted = [], weather = null) {
  let score = 0

  if (wanted.length === 0) {
    score += 35                                    // no stated needs: neutral baseline
  } else {
    const hits = wanted.filter(f => place.facilities.includes(f)).length
    score += (hits / wanted.length) * 50
  }

  if (place.openNow) score += 15
  if (place.crowdLevel === 'quiet') score += 20
  else if (place.crowdLevel === 'moderate') score += 10

  score += (Number(place.rating) || 0) / 5 * 15

  if (!place.indoor && weather) {
    if (weather.raining) score -= 25
    else if (weather.fair) score += 10
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function scoreBand(score) {
  if (score >= 75) return 'high'
  if (score >= 45) return 'mid'
  return 'low'
}
