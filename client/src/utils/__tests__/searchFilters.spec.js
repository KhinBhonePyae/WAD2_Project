import { describe, it, expect } from 'vitest'
import {
  filterPlaces,
  prefsFromUserPreferences,
  DEFAULT_PREFS,
  distanceKm,
  isWithinRadius,
  sortByDistance,
} from '../searchFilters.js'

const SMU = { lat: 1.2966, lng: 103.8507 }

const places = [
  { id: 1, openNow: true, indoor: true, crowdLevel: 'quiet', entry: 'free' },
  { id: 2, openNow: false, indoor: true, crowdLevel: 'packed' },
  { id: 3, openNow: true, indoor: false, crowdLevel: 'moderate', entry: 'purchase' },
  { id: 4, openNow: true, indoor: true, crowdLevel: null, entry: 'pass' },
]
const ids = (list) => list.map((p) => p.id)

describe('filterPlaces', () => {
  it('keeps everything with the default filters', () => {
    expect(ids(filterPlaces(places, DEFAULT_PREFS))).toEqual([1, 2, 3, 4])
  })
  it('can show only places open now', () => {
    expect(ids(filterPlaces(places, { ...DEFAULT_PREFS, openNowOnly: true }))).toEqual([1, 3, 4])
  })
  it('can show only places with free entry', () => {
    expect(ids(filterPlaces(places, { ...DEFAULT_PREFS, freeEntryOnly: true }))).toEqual([1])
  })
  it('can show only indoor or only outdoor places', () => {
    expect(ids(filterPlaces(places, { ...DEFAULT_PREFS, setting: 'indoor' }))).toEqual([1, 2, 4])
    expect(ids(filterPlaces(places, { ...DEFAULT_PREFS, setting: 'outdoor' }))).toEqual([3])
  })
  it('hides places busier than the chosen crowd level', () => {
    expect(ids(filterPlaces(places, { ...DEFAULT_PREFS, maxCrowd: 'quiet' }))).toEqual([1, 4])
    expect(ids(filterPlaces(places, { ...DEFAULT_PREFS, maxCrowd: 'moderate' }))).toEqual([1, 3, 4])
  })
  it('never hides places without crowd reports', () => {
    expect(ids(filterPlaces(places, { ...DEFAULT_PREFS, maxCrowd: 'quiet' }))).toContain(4)
  })
})

describe('prefsFromUserPreferences', () => {
  it('turns required Wi-Fi into a strict facility filter', () => {
    expect(prefsFromUserPreferences({ wifiRequired: true })).toEqual({
      facilities: ['wifi'],
      strictFacilities: true,
    })
  })
  it('keeps "preferred" quiet as a soft filter', () => {
    expect(prefsFromUserPreferences({ quietPreferred: true })).toEqual({
      facilities: ['quiet'],
      strictFacilities: false,
    })
  })
  it('turns an indoor preference into the indoor setting', () => {
    expect(prefsFromUserPreferences({ indoorPreferred: true })).toEqual({ setting: 'indoor' })
  })
  it('returns nothing when no preferences are set', () => {
    expect(prefsFromUserPreferences({})).toEqual({})
  })
})

describe('distanceKm', () => {
  it('is 0 for the same point', () => {
    expect(distanceKm(SMU, SMU)).toBe(0)
  })
  it('matches a plausible short distance', () => {
    const nlb = { lat: 1.2974, lng: 103.8545 }
    const d = distanceKm(SMU, nlb)
    expect(d).toBeGreaterThan(0.3)
    expect(d).toBeLessThan(1.5)
  })
  it('returns Infinity for missing or malformed coords', () => {
    expect(distanceKm(SMU, null)).toBe(Infinity)
    // CHANGE THIS LINE to use a truly invalid string instead of '1.2'
    expect(distanceKm({ lat: 'not-a-number', lng: 103.8 }, SMU)).toBe(Infinity)
  })
})

describe('filterPlaces nearby', () => {
  const nearbyPlaces = [
    { _id: 'a', name: 'Near', lat: 1.2970, lng: 103.8510 },
    { _id: 'b', name: 'Far', lat: 1.3500, lng: 103.9000 },
    { _id: 'c', name: 'NoCoords' },
  ]

  it('keeps only places inside the radius', () => {
    const out = filterPlaces(nearbyPlaces, {
      ...DEFAULT_PREFS, nearbyOnly: true, radiusKm: 1, userLocation: SMU,
    })
    expect(out.map((p) => p._id)).toEqual(['a'])
  })

  it('is a no-op when there is no user location', () => {
    const out = filterPlaces(nearbyPlaces, {
      ...DEFAULT_PREFS, nearbyOnly: true, radiusKm: 1, userLocation: null,
    })
    expect(out).toHaveLength(3)
  })

  it('excludes coordless places only when a location is present', () => {
    expect(isWithinRadius({ name: 'x' }, SMU, 5)).toBe(false)
    expect(isWithinRadius({ name: 'x' }, null, 5)).toBe(true)
  })
})

describe('sortByDistance', () => {
  it('orders nearest first, unknown coords last', () => {
    const out = sortByDistance([
      { _id: 'far', lat: 1.35, lng: 103.9 },
      { _id: 'near', lat: 1.2967, lng: 103.8508 },
      { _id: 'nowhere' },
    ], SMU)
    expect(out.map((p) => p._id)).toEqual(['near', 'far', 'nowhere'])
  })
})