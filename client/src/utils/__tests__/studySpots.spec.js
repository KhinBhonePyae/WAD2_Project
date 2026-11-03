import { describe, it, expect } from 'vitest'
import { STUDY_SPOTS, isSpot, spotMatches, orderBySpots, spotLabels } from '../studySpots.js'

describe('studySpots.isSpot', () => {
  it('indoor requires place.indoor === true', () => {
    expect(isSpot({ indoor: true }, 'indoor')).toBe(true)
    expect(isSpot({ indoor: false }, 'indoor')).toBe(false)
    expect(isSpot({}, 'indoor')).toBe(false)
  })

  it('outdoor is any place that is not indoor, or tagged "Outdoor"', () => {
    expect(isSpot({ indoor: false }, 'outdoor')).toBe(true)
    expect(isSpot({}, 'outdoor')).toBe(true)
    expect(isSpot({ indoor: true }, 'outdoor')).toBe(false)
    expect(isSpot({ indoor: true, tags: ['Outdoor'] }, 'outdoor')).toBe(true)
  })

  it('cafe matches café-ish place types', () => {
    expect(isSpot({ placeType: 'cafe' }, 'cafe')).toBe(true)
    expect(isSpot({ placeType: 'coffee_shop' }, 'cafe')).toBe(true)
    expect(isSpot({ placeType: 'tea_house' }, 'cafe')).toBe(true)
    expect(isSpot({ placeType: 'library' }, 'cafe')).toBe(false)
  })

  it('library matches NLB branches, library types, and names', () => {
    expect(isSpot({ branchCode: 'TRL' }, 'library')).toBe(true)
    expect(isSpot({ placeType: 'library' }, 'library')).toBe(true)
    expect(isSpot({ name: 'Central Library' }, 'library')).toBe(true)
    expect(isSpot({ name: 'Bugis Cafe', placeType: 'cafe' }, 'library')).toBe(false)
  })

  it('returns false for an unknown key', () => {
    expect(isSpot({}, 'gym')).toBe(false)
  })
})

describe('studySpots.spotMatches', () => {
  it('returns only the preferred kinds this place actually is', () => {
    const place = { indoor: true, placeType: 'cafe' }
    expect(spotMatches(place, ['indoor', 'cafe', 'library'])).toEqual(['indoor', 'cafe'])
  })

  it('returns [] when no preferences are given', () => {
    expect(spotMatches({ indoor: true }, [])).toEqual([])
  })
})

describe('studySpots.orderBySpots', () => {
  it('returns the list untouched when there are no preferred kinds', () => {
    const list = [{ id: 1 }, { id: 2 }]
    expect(orderBySpots(list, [])).toBe(list)
  })

  it('puts places matching more preferred kinds first', () => {
    const list = [
      { id: 'cafe', placeType: 'cafe' },               // 1 match (cafe)
      { id: 'indoor-cafe', indoor: true, placeType: 'cafe' }, // 2 matches (indoor, cafe)
      { id: 'other', placeType: 'park' },              // 0 matches
    ]
    const out = orderBySpots(list, ['indoor', 'cafe'])
    expect(out.map((p) => p.id)).toEqual(['indoor-cafe', 'cafe', 'other'])
  })

  it('keeps the original order for ties', () => {
    const list = [
      { id: 'a', indoor: true },
      { id: 'b', indoor: true },
    ]
    expect(orderBySpots(list, ['indoor']).map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('studySpots.spotLabels', () => {
  it('returns the human labels of the requested keys', () => {
    expect(spotLabels(['indoor', 'cafe'])).toEqual(['Indoor', 'Café'])
  })

  it('drops unknown keys', () => {
    expect(spotLabels(['indoor', 'gym'])).toEqual(['Indoor'])
  })

  it('returns [] for no keys', () => {
    expect(spotLabels([])).toEqual([])
  })
})

describe('studySpots.STUDY_SPOTS', () => {
  it('contains exactly the four expected kinds', () => {
    expect(STUDY_SPOTS.map((s) => s.key)).toEqual(['indoor', 'outdoor', 'cafe', 'library'])
  })
})