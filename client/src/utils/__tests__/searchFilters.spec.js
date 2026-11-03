import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PREFS, RADIUS_OPTIONS,
  distanceKm, placeCoords, isWithinRadius,
  filterPlaces, sortByDistance, prefsFromUserPreferences,
} from '../searchFilters.js'

/* -------------------------------------------------------------------------- */
/* distanceKm                                                                 */
/* -------------------------------------------------------------------------- */
describe('searchFilters.distanceKm', () => {
  it('is 0 for the same point', () => {
    expect(distanceKm({ lat: 1.2966, lng: 103.85 }, { lat: 1.2966, lng: 103.85 })).toBe(0)
  })

  it('is ~111 km for 1° of latitude at the equator', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0)
  })

  it('returns Infinity when either point is invalid', () => {
    expect(distanceKm(null, { lat: 1, lng: 1 })).toBe(Infinity)
    expect(distanceKm({ lat: 1, lng: 1 }, {})).toBe(Infinity)
    expect(distanceKm({ lat: 'a', lng: 'b' }, { lat: 1, lng: 1 })).toBe(Infinity)
  })

  it('accepts { latitude, longitude } as well as { lat, lng }', () => {
    expect(
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }),
    ).toBeCloseTo(111.2, 0)
  })
})

/* -------------------------------------------------------------------------- */
/* placeCoords                                                                */
/* -------------------------------------------------------------------------- */
describe('searchFilters.placeCoords', () => {
  it('reads GeoJSON [lng, lat] coordinates', () => {
    const place = { location: { coordinates: [103.85, 1.2966] } }
    expect(placeCoords(place)).toEqual({ lat: 1.2966, lng: 103.85 })
  })

  it('reads plain lat/lng fields', () => {
    expect(placeCoords({ lat: 1.2966, lng: 103.85 })).toEqual({ lat: 1.2966, lng: 103.85 })
  })

  it('reads lon as an alias for lng', () => {
    expect(placeCoords({ lat: 1.2966, lon: 103.85 })).toEqual({ lat: 1.2966, lng: 103.85 })
  })

  it('returns null when coords are missing', () => {
    expect(placeCoords(null)).toBeNull()
    expect(placeCoords({})).toBeNull()
    expect(placeCoords({ lat: 1.3 })).toBeNull()
  })

  it('ignores a malformed coordinates array', () => {
    expect(placeCoords({ location: { coordinates: [1] } })).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* isWithinRadius                                                             */
/* -------------------------------------------------------------------------- */
describe('searchFilters.isWithinRadius', () => {
  const user = { lat: 0, lng: 0 }
  const near = { lat: 0, lng: 0.005 }   // ~0.55 km away
  const far = { lat: 0, lng: 1 }        // ~111 km away

  it('is true when the place is inside the radius', () => {
    expect(isWithinRadius(near, user, 1)).toBe(true)
  })

  it('is false when the place is outside the radius', () => {
    expect(isWithinRadius(far, user, 2)).toBe(false)
  })

  it('is true for any place when the user has no location', () => {
    expect(isWithinRadius(far, null, 1)).toBe(true)
  })

  it('is false when the place has no coordinates', () => {
    expect(isWithinRadius({}, user, 1)).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* filterPlaces                                                               */
/* -------------------------------------------------------------------------- */
describe('searchFilters.filterPlaces', () => {
  const places = [
    { id: 1, openNow: true, entry: 'free', indoor: true, crowdLevel: 'quiet' },
    { id: 2, openNow: false, entry: 'purchase', indoor: false, crowdLevel: 'moderate' },
    { id: 3, openNow: true, entry: 'pass', indoor: true, crowdLevel: 'packed' },
    { id: 4, openNow: true, entry: 'free', indoor: false },   // no crowd
  ]
  const withPrefs = (extra) => ({ ...DEFAULT_PREFS, ...extra })
  const ids = (list) => list.map((p) => p.id)

  it('returns everything when the prefs are all "any/false"', () => {
    expect(ids(filterPlaces(places, withPrefs({})))).toEqual([1, 2, 3, 4])
  })

  it('openNowOnly keeps only open places', () => {
    expect(ids(filterPlaces(places, withPrefs({ openNowOnly: true })))).toEqual([1, 3, 4])
  })

  it('freeEntryOnly keeps only free-entry places', () => {
    expect(ids(filterPlaces(places, withPrefs({ freeEntryOnly: true })))).toEqual([1, 4])
  })

  it('setting=indoor keeps only indoor places', () => {
    expect(ids(filterPlaces(places, withPrefs({ setting: 'indoor' })))).toEqual([1, 3])
  })

  it('setting=outdoor keeps only non-indoor places', () => {
    expect(ids(filterPlaces(places, withPrefs({ setting: 'outdoor' })))).toEqual([2, 4])
  })

  it('maxCrowd=quiet keeps quiet places and places with no crowd', () => {
    expect(ids(filterPlaces(places, withPrefs({ maxCrowd: 'quiet' })))).toEqual([1, 4])
  })

  it('maxCrowd=moderate also keeps moderate', () => {
    expect(ids(filterPlaces(places, withPrefs({ maxCrowd: 'moderate' })))).toEqual([1, 2, 4])
  })

  it('nearbyOnly is a no-op when there is no user location', () => {
    expect(ids(filterPlaces(places, withPrefs({ nearbyOnly: true })))).toEqual([1, 2, 3, 4])
  })

  it('nearbyOnly drops places outside the radius when a user location is set', () => {
    const userLocation = { lat: 0, lng: 0 }
    const list = [
      { id: 1, lat: 0, lng: 0.005 },   // ~0.55 km away
      { id: 2, lat: 0, lng: 1 },       // ~111 km away
    ]
    expect(ids(filterPlaces(list, withPrefs({ nearbyOnly: true, radiusKm: 1, userLocation })))).toEqual([1])
  })

  it('nearbyOnly falls back to DEFAULT radius when radiusKm is falsy', () => {
    const userLocation = { lat: 0, lng: 0 }
    const list = [
      { id: 1, lat: 0, lng: 1 },       // ~111 km away — never inside default 2 km
    ]
    expect(ids(filterPlaces(list, withPrefs({ nearbyOnly: true, radiusKm: 0, userLocation })))).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* sortByDistance                                                             */
/* -------------------------------------------------------------------------- */
describe('searchFilters.sortByDistance', () => {
  it('sorts by distance from the user', () => {
    const user = { lat: 0, lng: 0 }
    const list = [
      { id: 'far', lat: 0, lng: 1 },
      { id: 'near', lat: 0, lng: 0.01 },
      { id: 'mid', lat: 0, lng: 0.1 },
    ]
    expect(sortByDistance(list, user).map((p) => p.id)).toEqual(['near', 'mid', 'far'])
  })

  it('returns the same list unchanged when there is no user location', () => {
    const list = [{ id: 1 }, { id: 2 }]
    expect(sortByDistance(list, null)).toBe(list)
  })
})

/* -------------------------------------------------------------------------- */
/* prefsFromUserPreferences                                                   */
/* -------------------------------------------------------------------------- */
describe('searchFilters.prefsFromUserPreferences', () => {
  it('maps wifiRequired to facilities + strictFacilities', () => {
    expect(prefsFromUserPreferences({ wifiRequired: true })).toEqual({
      facilities: ['wifi'],
      strictFacilities: true,
    })
  })

  it('maps quietPreferred to facilities, with strictFacilities=false', () => {
    expect(prefsFromUserPreferences({ quietPreferred: true })).toEqual({
      facilities: ['quiet'],
      strictFacilities: false,
    })
  })

  it('maps indoorPreferred to setting=indoor', () => {
    expect(prefsFromUserPreferences({ indoorPreferred: true })).toEqual({ setting: 'indoor' })
  })

  it('combines multiple preference kinds', () => {
    const out = prefsFromUserPreferences({
      wifiRequired: true, socketsRequired: true, quietPreferred: true, indoorPreferred: true,
    })
    expect(out.facilities).toEqual(expect.arrayContaining(['wifi', 'sockets', 'quiet']))
    expect(out.setting).toBe('indoor')
    expect(out.strictFacilities).toBe(true)
  })

  it('returns {} for empty preferences', () => {
    expect(prefsFromUserPreferences({})).toEqual({})
  })
})

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */
describe('searchFilters.RADIUS_OPTIONS', () => {
  it('only contains 500m, 1km and 2km', () => {
    expect(RADIUS_OPTIONS.map((o) => o.value)).toEqual([0.5, 1, 2])
  })
})