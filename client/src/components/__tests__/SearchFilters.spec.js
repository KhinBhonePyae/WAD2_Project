import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SearchFilters from '../SearchFilters.vue'
import { DEFAULT_PREFS } from '../../utils/searchFilters.js'

// jsdom has no geolocation. Replace it before each test so results don't leak.
function mockGeo(impl) {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: { getCurrentPosition: vi.fn(impl) },
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: undefined,
    configurable: true,
    writable: true,
  })
})

function mountFilters() {
  return mount(SearchFilters, { props: { modelValue: { ...DEFAULT_PREFS } } })
}

describe('SearchFilters — nearby', () => {
  it('requests location when the toggle is switched on', async () => {
    const success = vi.fn((cb) =>
      cb({ coords: { latitude: 1.2966, longitude: 103.8507 } })
    )
    mockGeo(success)

    const wrapper = mountFilters()
    await wrapper.get('[data-test="nearby-toggle"]').setValue(true)
    await flushPromises()

    expect(success).toHaveBeenCalled()
    expect(wrapper.get('[data-test="location-ok"]').text()).toContain('km')
  })

  it('emits radiusKm on apply once a location is set', async () => {
    mockGeo((cb) => cb({ coords: { latitude: 1.2966, longitude: 103.8507 } }))

    const wrapper = mountFilters()
    await wrapper.get('[data-test="nearby-toggle"]').setValue(true)
    await flushPromises()

    const radiusSelect = wrapper.get('[data-test="radius-select"]')
    await radiusSelect.get('button').trigger('click')
    await flushPromises()

    // 1. Look for the options (which are now 500m, 1km, 2km)
    const options = radiusSelect.findAll('li')

    // 2. CHANGE THIS to find "2 km" instead of "5 km"
    const option2 = options.find(o => o.text().includes('2 km'))
    await option2.trigger('click')
    await flushPromises()

    await wrapper.get('[data-test="apply-filters"]').trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()

    // 3. CHANGE THIS to expect 2 instead of 5
    expect(emitted[0][0].radiusKm).toBe(2)
  })

  it('shows an error when permission is denied', async () => {
    mockGeo((_, err) => err({ code: 1, PERMISSION_DENIED: 1 }))

    const wrapper = mountFilters()
    await wrapper.get('[data-test="nearby-toggle"]').setValue(true)
    await flushPromises()

    expect(wrapper.find('[data-test="location-error"]').exists()).toBe(true)
  })
})