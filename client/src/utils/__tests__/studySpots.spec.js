import { describe, it, expect } from 'vitest'
import { isSpot, spotMatches, orderBySpots, spotLabels } from '../studySpots.js'

const library = { id: 1, name: 'Bishan Public Library', indoor: true, branchCode: 'BIPL', tags: [] }
const cafe = { id: 2, name: 'Kopi Corner', indoor: true, placeType: 'coffee_shop', tags: [] }
const terrace = { id: 3, name: 'Funan Study Terrace', indoor: true, placeType: '', tags: ['Outdoor'] }
const park = { id: 4, name: 'Park Bench', indoor: false, placeType: '', tags: [] }

describe('isSpot', () => {
  it('recognises libraries by NLB branch code or name', () => {
    expect(isSpot(library, 'library')).toBe(true)
    expect(isSpot({ name: 'SMU Li Ka Shing Library' }, 'library')).toBe(true)
    expect(isSpot(cafe, 'library')).toBe(false)
  })

  it('recognises every coffee-type Google category as a café', () => {
    expect(isSpot(cafe, 'cafe')).toBe(true)
    expect(isSpot({ placeType: 'tea_house' }, 'cafe')).toBe(true)
    expect(isSpot(library, 'cafe')).toBe(false)
  })

  it('counts outdoor seating and fully outdoor places as outdoor', () => {
    expect(isSpot(terrace, 'outdoor')).toBe(true)
    expect(isSpot(park, 'outdoor')).toBe(true)
    expect(isSpot(library, 'outdoor')).toBe(false)
    expect(isSpot(park, 'indoor')).toBe(false)
  })
})

describe('orderBySpots', () => {
  const list = [park, cafe, library, terrace]

  it('keeps the order when the user has no favourite spots', () => {
    expect(orderBySpots(list, []).map(p => p.id)).toEqual([4, 2, 1, 3])
  })

  it('moves matching places first and keeps the rest in their order', () => {
    expect(orderBySpots(list, ['library']).map(p => p.id)).toEqual([1, 4, 2, 3])
  })

  it('ranks places matching more favourites higher, and hides nothing', () => {
    const ordered = orderBySpots(list, ['indoor', 'cafe'])
    expect(ordered.map(p => p.id)).toEqual([2, 1, 3, 4])
    expect(ordered).toHaveLength(list.length)
  })
})

describe('labels', () => {
  it('lists the matches in a fixed order', () => {
    expect(spotMatches(terrace, ['outdoor', 'indoor'])).toEqual(['outdoor', 'indoor'])
    expect(spotLabels(['library', 'indoor'])).toEqual(['Indoor', 'Library'])
  })
})
