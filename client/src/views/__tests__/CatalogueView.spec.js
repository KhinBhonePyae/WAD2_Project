import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import axios from 'axios'
import CatalogueView from '../CatalogueView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))
vi.mock('../../utils/weather.js', () => ({
  fetchWeather: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../../utils/saved.js', () => ({
  fetchSavedIds: vi.fn(() => Promise.resolve([])),
  toggleSavedId: vi.fn(),
  isLoggedIn: vi.fn(() => false),
}))
vi.mock('../../utils/suitability.js', () => ({
  suitabilityScore: vi.fn((p) => p.rating || 0),
  preferencesToWanted: vi.fn(() => []),
}))
vi.mock('../../utils/motion.js', () => ({
  gsap: {
    context: vi.fn(() => ({ revert: vi.fn(), add: vi.fn() })),
    from: vi.fn(), to: vi.fn(), set: vi.fn(), killTweensOf: vi.fn(),
    utils: { toArray: vi.fn(() => []) },
  },
  ScrollTrigger: { batch: vi.fn(), refresh: vi.fn() },
  reducedMotion: true,
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot/></a>' },
}))

// Stub the children so the test is about the view's own logic
vi.mock('../../components/PlaceCard.vue', () => ({
  default: {
    name: 'PlaceCard',
    props: ['place', 'saved'],
    emits: ['toggle-save'],
    template: `<div data-test="place-card" @click="$emit('toggle-save', place.id)">{{ place.name }}</div>`,
  },
}))
vi.mock('../../components/WeatherStage.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/FilterChips.vue', () => ({
  default: {
    name: 'FilterChips',
    props: ['options', 'selected'],
    emits: ['toggle'],
    template: `<div><button v-for="o in options" :key="o.value" :data-test="'chip-' + o.value"
                       @click="$emit('toggle', o.value)">{{ o.label }}</button></div>`,
  },
}))

const mountView = () =>
  mount(CatalogueView, { global: { stubs: { RouterLink: RouterLinkStub } } })

const place = (id, extra = {}) => ({
  id, name: `Place ${id}`, area: 'Area', hours: '9-9',
  openNow: true, indoor: true, rating: 4, reviewCount: 1,
  facilities: ['wifi'], photos: [], closureStatus: 'normal', ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('CatalogueView: loading', () => {
  it('renders one card per result and shows the result count', async () => {
    axios.get.mockResolvedValue({ data: [place(1), place(2), place(3)] })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('[data-test="place-card"]')).toHaveLength(3)
    expect(wrapper.find('[data-test="result-count"]').text()).toContain('3 spots')
  })

  it('shows the empty state when no results match filters', async () => {
    axios.get.mockResolvedValue({ data: [place(1, { name: 'Alpha' })] })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="cat-search"]').setValue('zzzz')
    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('shows the load error and Try again when the API fails', async () => {
    axios.get.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="load-error"]').exists()).toBe(true)
  })
})

describe('CatalogueView: filters', () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({
      data: [
        place(1, { name: 'Quiet Cafe', facilities: ['wifi', 'quiet'], indoor: true }),
        place(2, { name: 'Sunny Deck', facilities: ['wifi'], indoor: false }),
        place(3, { name: 'Closed', openNow: false }),
      ],
    })
  })

  it('filters by the search term (name only)', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="cat-search"]').setValue('sunny')
    const cards = wrapper.findAll('[data-test="place-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toBe('Sunny Deck')
  })

  it('filters by facility chips', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="chip-quiet"]').trigger('click')
    expect(wrapper.findAll('[data-test="place-card"]')).toHaveLength(1)
    expect(wrapper.find('[data-test="place-card"]').text()).toBe('Quiet Cafe')
  })

  it('indoor and outdoor are mutually exclusive', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="chip-indoor"]').trigger('click')
    expect(wrapper.find('[data-test="chip-indoor"]').attributes('aria-pressed')).toBe('true')

    await wrapper.find('[data-test="chip-outdoor"]').trigger('click')
    expect(wrapper.find('[data-test="chip-indoor"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-test="chip-outdoor"]').attributes('aria-pressed')).toBe('true')

    const cards = wrapper.findAll('[data-test="place-card"]')
    expect(cards.map((c) => c.text())).toEqual(['Sunny Deck'])
  })

  it('Clear filters resets everything and shows every place', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="chip-indoor"]').trigger('click')
    await wrapper.find('[data-test="chip-open"]').trigger('click')
    await wrapper.find('[data-test="cat-search"]').setValue('x')

    await wrapper.find('[data-test="clear-filters"]').trigger('click')

    expect(wrapper.find('[data-test="chip-indoor"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-test="chip-open"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-test="cat-search"]').element.value).toBe('')
    expect(wrapper.findAll('[data-test="place-card"]')).toHaveLength(3)
  })
})

describe('CatalogueView: save', () => {
  it('redirects anonymous users to /login when they try to save', async () => {
    axios.get.mockResolvedValue({ data: [place(1)] })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="place-card"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/login')
  })
})