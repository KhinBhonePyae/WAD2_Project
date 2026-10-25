import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CrowdHistogram from '../CrowdHistogram.vue'
import { fetchPlaceCrowd, fetchMyCheckin, checkIn, undoCheckin } from '../../utils/crowd.js'

// The card's API calls are faked, so these tests need no server.
// timeAgo, isFresh and the labels stay real.
vi.mock('../../utils/crowd.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPlaceCrowd: vi.fn(),
  fetchMyCheckin: vi.fn(),
  checkIn: vi.fn(),
  undoCheckin: vi.fn(),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const MIN = 60 * 1000
const minutesAgo = (m) => new Date(Date.now() - m * MIN).toISOString()
const NONE = { latest: null, counts: { quiet: 0, moderate: 0, packed: 0 }, total: 0 }
const openPlace = { id: 7, openNow: true, intent: null }

async function mountCard({ crowd = NONE, mine = null, place = openPlace } = {}) {
  fetchPlaceCrowd.mockResolvedValue(crowd)
  fetchMyCheckin.mockResolvedValue(mine)
  const wrapper = mount(CrowdHistogram, { props: { place } })
  await flushPromises()
  return wrapper
}

const find = (wrapper, name) => wrapper.find(`[data-test="${name}"]`)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('CrowdHistogram: what it shows', () => {
  it('invites the first report when there are none, instead of an empty chart', async () => {
    const wrapper = await mountCard()
    expect(find(wrapper, 'crowd-none').text()).toContain('Be the first')
    expect(find(wrapper, 'crowd-latest').exists()).toBe(false)
    expect(find(wrapper, 'checkin-quiet').exists()).toBe(true)
  })

  it('shows a recent report as "right now", with who reported it and when', async () => {
    const wrapper = await mountCard({
      crowd: { latest: { level: 'quiet', at: minutesAgo(5), source: 'check-in' }, counts: { quiet: 3, moderate: 1, packed: 0 }, total: 4 },
    })
    const latest = find(wrapper, 'crowd-latest').text()
    expect(latest).toContain('Quiet right now')
    expect(latest).toContain('Reported 5 min ago in a check-in')
  })

  it('says "last reported" when the newest report is old', async () => {
    const wrapper = await mountCard({
      crowd: { latest: { level: 'packed', at: minutesAgo(3 * 24 * 60), source: 'review' }, counts: { quiet: 0, moderate: 0, packed: 1 }, total: 1 },
    })
    expect(find(wrapper, 'crowd-latest').text()).toContain('Last reported packed')
    expect(find(wrapper, 'crowd-latest').text()).toContain('3 days ago in a review')
  })

  it('shows the split of every report as counts and percentages', async () => {
    const wrapper = await mountCard({
      crowd: { latest: { level: 'quiet', at: minutesAgo(5), source: 'review' }, counts: { quiet: 3, moderate: 1, packed: 0 }, total: 4 },
    })
    expect(wrapper.text()).toContain('All 4 reports so far')
    expect(wrapper.text()).toContain('3 (75%)')
    expect(wrapper.text()).toContain('1 (25%)')
    expect(wrapper.text()).toContain('0 (0%)')
  })

  it('shows how many people plan to go next', async () => {
    const wrapper = await mountCard({ place: { ...openPlace, intent: { day: 'Today', label: 'Afternoon', count: 3 } } })
    expect(find(wrapper, 'crowd-intent').text()).toBe('3 people are planning to go today, afternoon')
  })

  it('says "person is" for a single plan', async () => {
    const wrapper = await mountCard({ place: { ...openPlace, intent: { day: 'Tomorrow', label: 'Morning', count: 1 } } })
    expect(find(wrapper, 'crowd-intent').text()).toBe('1 person is planning to go tomorrow, morning')
  })

  it('hides the check-in buttons while the place is closed', async () => {
    const wrapper = await mountCard({ place: { ...openPlace, openNow: false } })
    expect(find(wrapper, 'checkin-quiet').exists()).toBe(false)
    expect(find(wrapper, 'crowd-checkin').text()).toContain('Check-ins open while this place is open')
  })

  it('shows an error if the reports cannot be loaded', async () => {
    fetchPlaceCrowd.mockRejectedValue(new Error('offline'))
    fetchMyCheckin.mockResolvedValue(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(CrowdHistogram, { props: { place: openPlace } })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Could not load crowd reports.')
    // a failed load must not claim the place has no reports
    expect(find(wrapper, 'crowd-none').exists()).toBe(false)
  })

  it('clears an old load error once the reports load again', async () => {
    fetchPlaceCrowd.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(NONE)
    fetchMyCheckin.mockResolvedValue(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(CrowdHistogram, { props: { place: openPlace } })
    await flushPromises()

    await wrapper.vm.reload()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(find(wrapper, 'crowd-none').exists()).toBe(true)
  })
})

describe('CrowdHistogram: checking in', () => {
  it('sends a logged-out visitor to the login page instead of reporting', async () => {
    const wrapper = await mountCard()
    await find(wrapper, 'checkin-quiet').trigger('click')
    expect(push).toHaveBeenCalledWith('/login')
    expect(checkIn).not.toHaveBeenCalled()
  })

  it('reports the tapped level and tells the place page', async () => {
    localStorage.setItem('token', 'test-token')
    const wrapper = await mountCard()
    checkIn.mockResolvedValue({})
    fetchMyCheckin.mockResolvedValue('quiet')   // what the server says after the tap

    await find(wrapper, 'checkin-quiet').trigger('click')
    await flushPromises()

    expect(checkIn).toHaveBeenCalledWith(7, 'quiet')
    expect(wrapper.emitted('reported')[0]).toEqual(['quiet'])
    expect(find(wrapper, 'checkin-quiet').attributes('aria-pressed')).toBe('true')
    expect(find(wrapper, 'checkin-thanks').exists()).toBe(true)
  })

  it('remembers the user’s own report after a reload', async () => {
    localStorage.setItem('token', 'test-token')
    const wrapper = await mountCard({ mine: 'moderate' })
    expect(find(wrapper, 'checkin-moderate').attributes('aria-pressed')).toBe('true')
    expect(find(wrapper, 'checkin-quiet').attributes('aria-pressed')).toBe('false')
  })

  it('shows the server’s error message when a report is refused', async () => {
    localStorage.setItem('token', 'test-token')
    const wrapper = await mountCard()
    checkIn.mockRejectedValue({ response: { status: 400, data: { error: 'This place is closed, so there is no crowd to report' } } })

    await find(wrapper, 'checkin-packed').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('This place is closed')
  })
})

describe('CrowdHistogram: undo', () => {
  it('the undo link takes the report back', async () => {
    localStorage.setItem('token', 'test-token')
    const wrapper = await mountCard({ mine: 'packed' })
    undoCheckin.mockResolvedValue()
    fetchMyCheckin.mockResolvedValue(null)

    await find(wrapper, 'checkin-undo').trigger('click')
    await flushPromises()

    expect(undoCheckin).toHaveBeenCalledWith(7)
    expect(wrapper.emitted('reported')[0]).toEqual([])
    expect(find(wrapper, 'checkin-thanks').exists()).toBe(false)
    expect(find(wrapper, 'checkin-packed').attributes('aria-pressed')).toBe('false')
  })

  it('tapping the chosen level again also undoes it', async () => {
    localStorage.setItem('token', 'test-token')
    const wrapper = await mountCard({ mine: 'quiet' })
    undoCheckin.mockResolvedValue()
    fetchMyCheckin.mockResolvedValue(null)

    await find(wrapper, 'checkin-quiet').trigger('click')
    await flushPromises()

    expect(undoCheckin).toHaveBeenCalledWith(7)
    expect(checkIn).not.toHaveBeenCalled()
  })
})
