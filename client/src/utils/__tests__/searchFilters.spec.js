import { describe, it, expect } from 'vitest'
import { filterPlaces, prefsFromUserPreferences, DEFAULT_PREFS } from '../searchFilters.js'

const places = [
  { id: 1, openNow: true, indoor: true, crowdLevel: 'quiet', entry: 'free' },
  { id: 2, openNow: false, indoor: true, crowdLevel: 'packed' },
  { id: 3, openNow: true, indoor: false, crowdLevel: 'moderate', entry: 'purchase' },
  { id: 4, openNow: true, indoor: true, crowdLevel: null, entry: 'pass' },   // no crowd reports yet
]
const ids = list => list.map(p => p.id)

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
    expect(prefsFromUserPreferences({ wifiRequired: true })).toEqual({ facilities: ['wifi'], strictFacilities: true })
  })
  it('keeps "preferred" quiet as a soft filter', () => {
    expect(prefsFromUserPreferences({ quietPreferred: true })).toEqual({ facilities: ['quiet'], strictFacilities: false })
  })
  it('turns an indoor preference into the indoor setting', () => {
    expect(prefsFromUserPreferences({ indoorPreferred: true })).toEqual({ setting: 'indoor' })
  })
  it('returns nothing when no preferences are set', () => {
    expect(prefsFromUserPreferences({})).toEqual({})
  })
})
