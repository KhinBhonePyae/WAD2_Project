import { describe, it, expect } from 'vitest'
import {
  FACILITY_LABELS, ENTRY_LABELS,
  preferencesToWanted, closureStatusOf,
  suitabilityBreakdown, suitabilityScore, scoreBand,
} from '../suitability.js'

/* -------------------------------------------------------------------------- */
/* scoreBand                                                                  */
/* -------------------------------------------------------------------------- */
describe('suitability.scoreBand', () => {
  it('75+ → high', () => {
    expect(scoreBand(100)).toBe('high')
    expect(scoreBand(75)).toBe('high')
  })
  it('45–74 → mid', () => {
    expect(scoreBand(74)).toBe('mid')
    expect(scoreBand(45)).toBe('mid')
  })
  it('< 45 → low', () => {
    expect(scoreBand(44)).toBe('low')
    expect(scoreBand(0)).toBe('low')
  })
})

/* -------------------------------------------------------------------------- */
/* closureStatusOf                                                            */
/* -------------------------------------------------------------------------- */
describe('suitability.closureStatusOf', () => {
  it('reads the field first', () => {
    expect(closureStatusOf({ closureStatus: 'permanent' })).toBe('permanent')
    expect(closureStatusOf({ closureStatus: 'temporary' })).toBe('temporary')
  })

  it('also recognises keywords in the hours string', () => {
    expect(closureStatusOf({ hours: 'Permanently closed' })).toBe('permanent')
    expect(closureStatusOf({ hours: 'Closed for renovation' })).toBe('temporary')
    expect(closureStatusOf({ hours: 'Temporarily closed' })).toBe('temporary')
  })

  it('defaults to normal', () => {
    expect(closureStatusOf({})).toBe('normal')
    expect(closureStatusOf({ hours: '9am–9pm' })).toBe('normal')
  })
})

/* -------------------------------------------------------------------------- */
/* preferencesToWanted                                                        */
/* -------------------------------------------------------------------------- */
describe('suitability.preferencesToWanted', () => {
  it('maps each preference to the corresponding facility key', () => {
    expect(preferencesToWanted({
      wifiRequired: true,
      socketsRequired: true,
      quietPreferred: true,
      indoorPreferred: true,
    })).toEqual(['wifi', 'sockets', 'quiet', 'indoor'])
  })

  it('returns [] for empty preferences', () => {
    expect(preferencesToWanted({})).toEqual([])
  })

  it('ignores unknown preferences', () => {
    expect(preferencesToWanted({ dogFriendly: true })).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* suitabilityBreakdown                                                       */
/* -------------------------------------------------------------------------- */
describe('suitability.suitabilityBreakdown', () => {
  it('zeroes out a permanently closed place', () => {
    const out = suitabilityBreakdown({ closureStatus: 'permanent' })
    expect(out.score).toBe(0)
    expect(out.reasons).toEqual(['Permanently closed'])
  })

  it('zeroes out a temporarily closed place', () => {
    const out = suitabilityBreakdown({ hours: 'Closed for renovation' })
    expect(out.score).toBe(0)
    expect(out.reasons).toEqual(['Temporarily closed'])
  })

  it('awards the +35 baseline with no preferences', () => {
    const out = suitabilityBreakdown({ openNow: false })
    // 35 baseline + 0 openNow + 0 crowd + 0 rating = 35, capped at 45 (still 35)
    expect(out.score).toBe(35)
  })

  it('caps a closed place at 45', () => {
    // 35 baseline + 0 openNow + 0 crowd + 15 rating = 50 → capped at 45
    const out = suitabilityBreakdown({ openNow: false, rating: 5 })
    expect(out.score).toBe(45)
    expect(out.reasons).toContain('Closed right now')
  })

  it('awards up to +50 for full preference match', () => {
    const place = { openNow: false, rating: 0, facilities: ['wifi', 'sockets'] }
    const out = suitabilityBreakdown(place, ['wifi', 'sockets'])
    // 50 preference + 0 openNow + 0 crowd + 0 rating = 50 → capped at 45
    expect(out.score).toBe(45)
    expect(out.reasons.some((r) => r.startsWith('Matches:'))).toBe(true)
  })

  it('half-credit for a half match', () => {
    const place = { openNow: false, rating: 0, facilities: ['wifi'] }
    const out = suitabilityBreakdown(place, ['wifi', 'sockets'])
    // 25 preference + 0 + 0 + 0 = 25, capped at 45 (still 25)
    expect(out.score).toBe(25)
    expect(out.reasons.some((r) => r.startsWith('Missing:'))).toBe(true)
  })

  it('awards +15 for open-now, +20 for a quiet crowd, +15 for 5★', () => {
    const out = suitabilityBreakdown({
      openNow: true, rating: 5, crowdLevel: 'quiet',
    })
    // 35 baseline + 15 openNow + 20 quiet + 15 rating = 85
    expect(out.score).toBe(85)
    expect(out.reasons).toEqual(expect.arrayContaining(['Open now', 'Last reported quiet']))
  })

  it('awards +10 for a moderately busy crowd, no crowd points for packed', () => {
    const moderate = suitabilityBreakdown({ openNow: true, rating: 0, crowdLevel: 'moderate' })
    // 35 + 15 + 10 + 0 = 60
    expect(moderate.score).toBe(60)

    const packed = suitabilityBreakdown({ openNow: true, rating: 0, crowdLevel: 'packed' })
    // 35 + 15 + 0 + 0 = 50
    expect(packed.score).toBe(50)
    expect(packed.reasons).toContain('Last reported packed')
  })

  it('subtracts 10 for a packed intent and 5 for a filling intent', () => {
    const packed = suitabilityBreakdown({
      openNow: true, rating: 0, intent: { level: 'packed' },
    })
    // 35 + 15 - 10 = 40
    expect(packed.score).toBe(40)

    const filling = suitabilityBreakdown({
      openNow: true, rating: 0, intent: { level: 'filling' },
    })
    // 35 + 15 - 5 = 45
    expect(filling.score).toBe(45)
  })

  it('penalises outdoor places for rain and rewards them in fair weather', () => {
    const base = { openNow: true, rating: 0, indoor: false }
    // 35 baseline + 15 openNow = 50

    const sunny = suitabilityBreakdown(base, [], { fair: true })
    expect(sunny.score).toBe(60)   // +10

    const rainy = suitabilityBreakdown(base, [], { raining: true })
    expect(rainy.score).toBe(25)   // -25
  })

  it('never penalises indoor places for rain', () => {
    const out = suitabilityBreakdown({ openNow: true, rating: 0, indoor: true }, [], { raining: true })
    // 35 + 15 = 50 (rain doesn't apply)
    expect(out.score).toBe(50)
  })

  it('clamps the score to 0–100', () => {
    // Full match + open + quiet + 5★ would exceed 100 if uncapped
    const out = suitabilityBreakdown(
      { openNow: true, rating: 5, crowdLevel: 'quiet', facilities: ['wifi'], indoor: true },
      ['wifi', 'indoor'],
      { fair: true },
    )
    expect(out.score).toBeLessThanOrEqual(100)
    expect(out.score).toBeGreaterThanOrEqual(0)
  })

  it('rounds to the nearest integer', () => {
    const out = suitabilityBreakdown({ openNow: true, rating: 4.4, crowdLevel: 'quiet' })
    // 35 + 15 + 20 + (4.4/5*15=13.2) = 83.2 → 83
    expect(out.score).toBe(83)
  })
})

/* -------------------------------------------------------------------------- */
/* suitabilityScore — thin wrapper                                            */
/* -------------------------------------------------------------------------- */
describe('suitability.suitabilityScore', () => {
  it('returns just the numeric score', () => {
    const place = { openNow: true, rating: 5, crowdLevel: 'quiet' }
    expect(suitabilityScore(place)).toBe(85)
  })
})

/* -------------------------------------------------------------------------- */
/* Static label maps                                                          */
/* -------------------------------------------------------------------------- */
describe('suitability labels', () => {
  it('FACILITY_LABELS has an entry for every facility key', () => {
    expect(FACILITY_LABELS).toMatchObject({
      wifi: 'Wi-Fi',
      sockets: 'Power sockets',
      quiet: 'Quiet environment',
      indoor: 'Indoor location',
    })
  })

  it('ENTRY_LABELS has an entry for every entry type', () => {
    expect(ENTRY_LABELS).toMatchObject({
      free: 'Free entry',
      purchase: 'Buy a drink',
      pass: 'Requires membership/day pass',
    })
  })
})