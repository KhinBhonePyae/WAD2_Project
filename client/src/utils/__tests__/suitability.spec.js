import { describe, it, expect } from 'vitest'
import { suitabilityScore, suitabilityBreakdown, preferencesToWanted, closureStatusOf, scoreBand } from '../suitability.js'

// A place that matches everything, so each test can change one thing at a time
const base = {
  indoor: true, openNow: true, crowdLevel: 'quiet', rating: 5,
  facilities: ['wifi', 'sockets', 'quiet'], hours: '09:00 - 21:00',
}

describe('preferencesToWanted', () => {
  it('turns the profile switches into facility keys', () => {
    expect(preferencesToWanted({ wifiRequired: true, indoorPreferred: true })).toEqual(['wifi', 'indoor'])
  })
  it('returns nothing when no preferences are set', () => {
    expect(preferencesToWanted()).toEqual([])
  })
})

describe('closureStatusOf', () => {
  it('reads renovation hours as temporarily closed', () => {
    expect(closureStatusOf({ hours: 'Closed for renovation' })).toBe('temporary')
  })
  it('respects a saved permanent closure', () => {
    expect(closureStatusOf({ closureStatus: 'permanent', hours: '09:00 - 21:00' })).toBe('permanent')
  })
  it('treats normal hours as normal', () => {
    expect(closureStatusOf(base)).toBe('normal')
  })
})

describe('suitabilityScore', () => {
  it('gives a perfect place full marks', () => {
    expect(suitabilityScore(base, ['wifi', 'sockets'])).toBe(100)
  })

  it('scores closed places 0', () => {
    expect(suitabilityScore({ ...base, hours: 'Closed for renovation' }, ['wifi'])).toBe(0)
  })

  it('caps a place that is closed right now at 45', () => {
    expect(suitabilityScore({ ...base, openNow: false }, ['wifi'])).toBeLessThanOrEqual(45)
  })

  it('rewards matching more of what the user wants', () => {
    const all = suitabilityScore(base, ['wifi', 'sockets'])
    const half = suitabilityScore({ ...base, facilities: ['wifi'] }, ['wifi', 'sockets'])
    expect(half).toBeLessThan(all)
  })

  it('ranks a quiet report above a packed one', () => {
    expect(suitabilityScore({ ...base, crowdLevel: 'quiet' }, []))
      .toBeGreaterThan(suitabilityScore({ ...base, crowdLevel: 'packed' }, []))
  })

  it('lowers outdoor places when it rains and raises them in fine weather', () => {
    const outdoor = { ...base, indoor: false }
    const dry = suitabilityScore(outdoor, [], null)
    expect(suitabilityScore(outdoor, [], { raining: true })).toBeLessThan(dry)
    expect(suitabilityScore({ ...outdoor, rating: 3 }, [], { fair: true }))
      .toBeGreaterThan(suitabilityScore({ ...outdoor, rating: 3 }, [], null))
  })

  it('ignores the weather for indoor places', () => {
    expect(suitabilityScore(base, [], { raining: true })).toBe(suitabilityScore(base, [], null))
  })

  it('treats a place with no reviews as rating 0, not an error', () => {
    expect(suitabilityScore({ ...base, rating: 0 }, [])).toBeGreaterThan(0)
  })

  it('always stays between 0 and 100', () => {
    const score = suitabilityScore({ ...base, indoor: false, crowdLevel: 'packed', rating: 0, intent: { level: 'packed' } }, ['wifi'], { raining: true })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

describe('suitabilityBreakdown reasons', () => {
  it('lists matched and missing facilities', () => {
    const { reasons } = suitabilityBreakdown({ ...base, facilities: ['wifi'] }, ['wifi', 'sockets'])
    expect(reasons).toContain('Matches: Wi-Fi')
    expect(reasons).toContain('Missing: Power sockets')
  })
  it('says the crowd level was last reported, not that it is live', () => {
    expect(suitabilityBreakdown(base, []).reasons).toContain('Last reported quiet')
  })
})

describe('scoreBand', () => {
  it('splits scores into high, mid and low', () => {
    expect(scoreBand(80)).toBe('high')
    expect(scoreBand(50)).toBe('mid')
    expect(scoreBand(10)).toBe('low')
  })
})
