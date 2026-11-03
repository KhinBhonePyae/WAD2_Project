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

function mountFilters(overrides = {}, extra = {}) {
  return mount(SearchFilters, {
    props: {
      modelValue: { ...DEFAULT_PREFS, ...overrides },
      ...extra,
    },
  })
}

// ---------------------------------------------------------------------------
// Nearby / geolocation
// ---------------------------------------------------------------------------
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

    const options = radiusSelect.findAll('li')
    const option2 = options.find(o => o.text().includes('2 km'))
    await option2.trigger('click')
    await flushPromises()

    await wrapper.get('[data-test="apply-filters"]').trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0].radiusKm).toBe(2)
  })

  it('shows an error when permission is denied', async () => {
    mockGeo((_, err) => err({ code: 1, PERMISSION_DENIED: 1 }))

    const wrapper = mountFilters()
    await wrapper.get('[data-test="nearby-toggle"]').setValue(true)
    await flushPromises()

    expect(wrapper.find('[data-test="location-error"]').exists()).toBe(true)
  })

  it('keeps Apply disabled while geolocation is in flight', async () => {
    // getCurrentPosition that never calls back
    mockGeo(() => {})

    const wrapper = mountFilters()
    await wrapper.get('[data-test="nearby-toggle"]').setValue(true)
    await flushPromises()

    expect(wrapper.get('[data-test="apply-filters"]').attributes('disabled')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Filter contract: facilities, reset, preferences
// ---------------------------------------------------------------------------
describe('SearchFilters — filter contract', () => {
  const prefs = {
    facilityOptions: ['wifi', 'power'],
    areaOptions: ['Bugis', 'Tampines'],
    hasPreferences: true,
  }

  it('toggles a facility on and emits it via apply', async () => {
    const wrapper = mountFilters({ facilities: [] }, prefs)

    await wrapper.get('[data-test="chip-wifi"]').trigger('click')
    await wrapper.get('[data-test="apply-filters"]').trigger('click')

    expect(wrapper.emitted('apply')?.[0]?.[0]?.facilities).toEqual(['wifi'])
  })

  it('removes a facility when its chip is toggled off again', async () => {
    const wrapper = mountFilters({ facilities: ['wifi'] }, prefs)

    await wrapper.get('[data-test="chip-wifi"]').trigger('click')
    await wrapper.get('[data-test="apply-filters"]').trigger('click')

    expect(wrapper.emitted('apply')?.[0]?.[0]?.facilities).toEqual([])
  })

  it('emits a fresh copy of the model on apply, not the same object', async () => {
    const wrapper = mountFilters({ facilities: [] }, prefs)
    await wrapper.get('[data-test="chip-wifi"]').trigger('click')
    await wrapper.get('[data-test="apply-filters"]').trigger('click')

    const emitted = wrapper.emitted('apply')?.[0]?.[0]
    expect(emitted).not.toBe(wrapper.props('modelValue'))
    // Mutating the emitted object must not affect the component's internal state.
    emitted.facilities.push('power')
    await wrapper.get('[data-test="apply-filters"]').trigger('click')
    expect(wrapper.emitted('apply')?.[1]?.[0]?.facilities).not.toContain('power')
  })

  it('resets to defaults and emits reset', async () => {
    const wrapper = mountFilters(
      { area: 'Bugis', facilities: ['wifi'], openNowOnly: true },
      prefs,
    )

    await wrapper.get('[data-test="reset-filters"]').trigger('click')

    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.emitted('reset')?.[0]).toEqual([])
  })

  it('shows the "use profile preferences" button only when hasPreferences is true', () => {
    const withPrefs = mountFilters({}, { ...prefs, hasPreferences: true })
    expect(withPrefs.find('[data-test="reset-to-preferences"]').exists()).toBe(true)

    const withoutPrefs = mountFilters({}, { ...prefs, hasPreferences: false })
    expect(withoutPrefs.find('[data-test="reset-to-preferences"]').exists()).toBe(false)
  })

  it('emits reset-to-preferences when the button is clicked', async () => {
    const wrapper = mountFilters({}, prefs)
    await wrapper.get('[data-test="reset-to-preferences"]').trigger('click')
    expect(wrapper.emitted('reset-to-preferences')).toHaveLength(1)
  })

  it('syncs internal state when the parent replaces modelValue', async () => {
    const wrapper = mountFilters({ facilities: [] }, prefs)
    await wrapper.setProps({
      modelValue: { ...DEFAULT_PREFS, facilities: ['power'] },
    })
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-test="apply-filters"]').trigger('click')

    expect(wrapper.emitted('apply')?.[0]?.[0]?.facilities).toEqual(['power'])
  })
})