import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import axios from 'axios'
import { fetchSavedIds, toggleSavedId } from '../../utils/saved.js'
import PlaceDetailView from '../PlaceDetailView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))
vi.mock('../../utils/weather.js', () => ({ fetchWeather: vi.fn(() => Promise.resolve(null)) }))
vi.mock('../../utils/motion.js', () => ({
  gsap: { context: vi.fn(() => ({ revert: vi.fn() })), from: vi.fn(), to: vi.fn() },
  reducedMotion: true,
}))
vi.mock('bootstrap', () => ({ Carousel: vi.fn(function () { this.cycle = vi.fn() }) }))
vi.mock('../../utils/saved.js', () => ({
  fetchSavedIds: vi.fn(() => Promise.resolve([])),
  toggleSavedId: vi.fn(),
  isLoggedIn: () => !!localStorage.getItem('token'),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '7' } }),
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot/></a>' },
}))

const PLACE = {
  id: 7, name: 'Test Cafe', address: '1 Test Road', description: '', hours: '9am-9pm',
  openNow: true, indoor: true, placeType: 'cafe', rating: 4, reviewCount: 1,
  facilities: ['wifi'], photos: ['a.jpg', 'b.jpg'], entry: 'purchase',
}

function mockPlace(place = PLACE) {
  axios.get.mockImplementation(url => {
    if (url.endsWith('/places/7')) return Promise.resolve({ data: place })
    if (url.includes('/reviews/place/7')) {
      return Promise.resolve({ data: { reviews: [], summary: { rating: 4, reviewCount: 1, crowdLevel: null } } })
    }
    return Promise.resolve({ data: {} })
  })
}

const STUBS = ['SuitabilityScore', 'CrowdMeter', 'StarRating', 'ReviewForm', 'ReviewList',
  'CrowdHistogram', 'IntentPanel', 'PlaceMap', 'ReportIssue']

const mountView = () => mount(PlaceDetailView, {
  global: { stubs: { RouterLink: RouterLinkStub, ...Object.fromEntries(STUBS.map(n => [n, true])) } },
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockPlace()
})

describe('PlaceDetailView save button', () => {
  it('shows the save button on the photo carousel', async () => {
    const wrapper = mountView()
    await flushPromises()
    const btn = wrapper.find('#placeCarousel [data-test="detail-save"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-pressed')).toBe('false')
  })

  it('has no save button when the place has no photos', async () => {
    mockPlace({ ...PLACE, photos: [] })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-test="detail-save"]').exists()).toBe(false)
  })

  it('sends a logged-out user to the login page', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-test="detail-save"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/login')
    expect(toggleSavedId).not.toHaveBeenCalled()
  })

  it('shows an already-saved place as saved', async () => {
    localStorage.setItem('token', 't')
    fetchSavedIds.mockResolvedValueOnce([7])
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-test="detail-save"]').attributes('aria-pressed')).toBe('true')
  })

  it('saves and unsaves the place when logged in', async () => {
    localStorage.setItem('token', 't')
    toggleSavedId.mockResolvedValueOnce([7]).mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()
    const btn = () => wrapper.find('[data-test="detail-save"]')

    await btn().trigger('click')
    await flushPromises()
    expect(toggleSavedId).toHaveBeenCalledWith([], 7)
    expect(btn().attributes('aria-pressed')).toBe('true')

    await btn().trigger('click')
    await flushPromises()
    expect(toggleSavedId).toHaveBeenLastCalledWith([7], 7)
    expect(btn().attributes('aria-pressed')).toBe('false')
  })

  it('keeps the old state if saving fails', async () => {
    localStorage.setItem('token', 't')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    toggleSavedId.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-test="detail-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="detail-save"]').attributes('aria-pressed')).toBe('false')
  })
})

describe('PlaceDetailView match panel', () => {
  it('shows preferred spot types in the match panel', async () => {
    localStorage.setItem('user', JSON.stringify({ name: 'J', preferences: { studySpots: ['cafe'] } }))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Why this matches you')
    expect(wrapper.text()).toContain('✓ Café')
  })

  it('hides the match panel when the user has no preferences', async () => {
    localStorage.setItem('user', JSON.stringify({ name: 'J', preferences: {} }))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Why this matches you')
  })
})
