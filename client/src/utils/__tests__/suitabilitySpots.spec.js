import { describe, it, expect } from 'vitest'
import { suitabilityBreakdown, suitabilityScore } from '../suitability.js'

/* Preferred study-spot types (preferences.studySpots) add a +10 bonus */
describe('suitability preferred spot types', () => {
  const cafe = { openNow: true, rating: 0, indoor: true, placeType: 'cafe' }
  const library = { openNow: true, rating: 0, indoor: true, branchCode: 'AMKPL', name: 'Ang Mo Kio Library' }

  it('adds 10 and a reason when the place is one of the preferred types', () => {
    const { score, reasons } = suitabilityBreakdown(cafe, [], null, ['cafe'])
    expect(score).toBe(35 + 15 + 10)
    expect(reasons).toContain('Your preferred type: Café')
  })

  it('leaves the score alone when the place is not a preferred type', () => {
    expect(suitabilityScore(library, [], null, ['cafe'])).toBe(suitabilityScore(library))
  })

  it('gives the bonus once even when several preferred types match', () => {
    const { score, reasons } = suitabilityBreakdown(cafe, [], null, ['cafe', 'indoor'])
    expect(score).toBe(60)
    expect(reasons).toContain('Your preferred type: Indoor, Café')
  })

  it('ignores missing or invalid spot lists', () => {
    expect(suitabilityScore(cafe, [], null, undefined)).toBe(50)
    expect(suitabilityScore(cafe, [], null, 'cafe')).toBe(50)
  })

  it('still caps closed places at 45 and closed-down places at 0', () => {
    expect(suitabilityScore({ ...cafe, openNow: false, rating: 5, crowdLevel: 'quiet' }, [], null, ['cafe'])).toBe(45)
    expect(suitabilityScore({ ...cafe, closureStatus: 'permanent' }, [], null, ['cafe'])).toBe(0)
  })

  it('never goes above 100', () => {
    const best = { ...cafe, rating: 5, crowdLevel: 'quiet', facilities: ['wifi'] }
    expect(suitabilityScore(best, ['wifi'], null, ['cafe'])).toBe(100)
  })
})
