import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import axios from 'axios'
import SavedView from '../SavedView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))
vi.mock('../../utils/motion.js', () => ({
  gsap: { context: vi.fn(() => ({ revert: vi.fn() })), quickTo: vi.fn(() => vi.fn()), fromTo: vi.fn() },
  finePointer: false,
  reducedMotion: true,
}))
vi.mock('../../utils/intents.js', () => ({
  LEVEL_LABELS: { quiet: 'Quiet', moderate: 'Moderate', packed: 'Packed' },
}))
vi.mock('../../utils/suitability.js', () => ({
  ENTRY_LABELS: { free: 'Free entry' },
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot/></a>' },
}))

const mountView = () =>
  mount(SavedView, { global: { stubs: { RouterLink: RouterLinkStub } } })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('SavedView', () => {
  it('redirects to /login when there is no token', async () => {
    mountView()
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/login')
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('fetches saved ids + places and shows only matching cards', async () => {
    localStorage.setItem('token', 't')
    axios.get
      .mockResolvedValueOnce({ data: { savedPlaceIds: [1, 3] } })               // /saved
      .mockResolvedValueOnce({
        data: [
          { id: 1, name: 'Alpha', area: 'A', hours: '9-9', openNow: true, rating: 4, reviewCount: 1, photos: [] },
          { id: 2, name: 'Beta',  area: 'B', hours: '9-9', openNow: true, rating: 4, reviewCount: 1, photos: [] },
          { id: 3, name: 'Gamma', area: 'C', hours: '9-9', openNow: true, rating: 4, reviewCount: 1, photos: [] },
        ],
      })                                                                        // /places

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('2 saved')
    expect(wrapper.findAll('[data-test="place-card"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).toContain('Gamma')
    expect(wrapper.text()).not.toContain('Beta')
  })

  it('shows the empty state when nothing is saved', async () => {
    localStorage.setItem('token', 't')
    axios.get
      .mockResolvedValueOnce({ data: { savedPlaceIds: [] } })
      .mockResolvedValueOnce({ data: [] })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.empty-card').text()).toContain('No saved places yet')
  })

  it('removes a place when its heart is tapped', async () => {
    localStorage.setItem('token', 't')
    axios.get
      .mockResolvedValueOnce({ data: { savedPlaceIds: [1] } })
      .mockResolvedValueOnce({
        data: [{ id: 1, name: 'Alpha', area: 'A', hours: '9-9', openNow: true, rating: 4, reviewCount: 1, photos: [] }],
      })
    axios.delete.mockResolvedValue({})

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="fav"]').trigger('click')
    await flushPromises()

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringMatching(/\/saved\/1$/),
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(wrapper.text()).toContain('0 saved')
    expect(wrapper.find('.empty-card').exists()).toBe(true)
  })

  it('logs out and redirects when loading saved places gets a 401', async () => {
    localStorage.setItem('token', 't')
    localStorage.setItem('user', '{"name":"Alex"}')
    axios.get.mockRejectedValue({ response: { status: 401 } })

    mountView()
    await flushPromises()

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(push).toHaveBeenCalledWith('/login')
  })
})