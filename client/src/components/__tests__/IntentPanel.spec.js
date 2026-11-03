import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import IntentPanel from '../IntentPanel.vue'
import { fetchPlaceIntents, fetchMyIntents, addIntent, removeIntent } from '../../utils/intents.js'

vi.mock('../../utils/intents.js', () => ({
  fetchPlaceIntents: vi.fn(),
  fetchMyIntents: vi.fn(),
  addIntent: vi.fn(),
  removeIntent: vi.fn(),
  LEVEL_LABELS: { quiet: 'Quiet', moderate: 'Moderate', packed: 'Packed' },
  LEVEL_BADGES: { quiet: 'badge-quiet', moderate: 'badge-moderate', packed: 'badge-packed' },
}))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const place = { id: 42, branchCode: null }

const TOMORROW_SLOTS = [
  { date: '2026-11-04', slot: 'morning', day: 'Tomorrow', label: 'Morning', count: 3, level: 'moderate' },
  { date: '2026-11-04', slot: 'afternoon', day: 'Tomorrow', label: 'Afternoon', count: 0, level: null },
]

async function mountPanel({ slots = TOMORROW_SLOTS, mine = [], place: placeProp = place } = {}) {
  fetchPlaceIntents.mockResolvedValue(slots)
  fetchMyIntents.mockResolvedValue(mine)
  const wrapper = mount(IntentPanel, { props: { place: placeProp } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('IntentPanel: rendering', () => {
  it('groups slots by day and shows counts and level badges', async () => {
    const wrapper = await mountPanel()
    const text = wrapper.text()
    expect(text).toContain('Tomorrow')
    expect(text).toContain('3 planning to go')
    expect(text).toContain('No one yet')
    expect(text).toContain('Moderate')
  })

  it('says there is nothing to plan when the place is closed for two days', async () => {
    const wrapper = await mountPanel({ slots: [] })
    expect(wrapper.find('[data-test="intent-none"]').exists()).toBe(true)
  })

  it('shows the NLB booking link when a branch code exists', async () => {
    const wrapper = await mountPanel({ place: { ...place, branchCode: 'TRL' } })
    const link = wrapper.find('[data-test="nlb-booking"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain('nlb.gov.sg')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('hides the NLB booking link without a branch code', async () => {
    const wrapper = await mountPanel()
    expect(wrapper.find('[data-test="nlb-booking"]').exists()).toBe(false)
  })

  it('shows a load error and does not crash when the API fails', async () => {
    fetchPlaceIntents.mockRejectedValue(new Error('offline'))
    fetchMyIntents.mockResolvedValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(IntentPanel, { props: { place } })
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Could not load who is planning to go')
    vi.restoreAllMocks()
  })
})

describe('IntentPanel: toggling', () => {
  it('routes anonymous users to /login without calling the API', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('[data-test="intent-toggle"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/login')
    expect(addIntent).not.toHaveBeenCalled()
  })

  it('adds an intent, reloads, and emits "changed"', async () => {
    localStorage.setItem('token', 't')
    addIntent.mockResolvedValue()
    const wrapper = await mountPanel()

    await wrapper.find('[data-test="intent-toggle"]').trigger('click')
    await flushPromises()

    expect(addIntent).toHaveBeenCalledWith(42, '2026-11-04', 'morning')
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('removes an intent when the user is already going', async () => {
    localStorage.setItem('token', 't')
    removeIntent.mockResolvedValue()
    const wrapper = await mountPanel({
      mine: [{ placeId: 42, date: '2026-11-04', slot: 'morning' }],
    })

    const toggle = wrapper.find('[data-test="intent-toggle"]')
    expect(toggle.text()).toContain('✓ Going')
    await toggle.trigger('click')
    await flushPromises()

    expect(removeIntent).toHaveBeenCalledWith(42, '2026-11-04', 'morning')
    expect(addIntent).not.toHaveBeenCalled()
  })

  it('redirects to /login on a 401 mid-toggle', async () => {
    localStorage.setItem('token', 't')
    addIntent.mockRejectedValue({ response: { status: 401 } })
    const wrapper = await mountPanel()

    await wrapper.find('[data-test="intent-toggle"]').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/login')
  })

  it('surfaces the server error for other failures', async () => {
    localStorage.setItem('token', 't')
    addIntent.mockRejectedValue({
      response: { status: 400, data: { error: 'That slot is full.' } },
    })
    const wrapper = await mountPanel()

    await wrapper.find('[data-test="intent-toggle"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('That slot is full.')
  })

  // NEW: the button is disabled while the add/remove request is in flight
  it('disables the toggle button while the request is in flight', async () => {
    localStorage.setItem('token', 't')
    let resolveAdd
    addIntent.mockImplementation(() => new Promise((r) => { resolveAdd = r }))

    const wrapper = await mountPanel()
    const toggle = wrapper.find('[data-test="intent-toggle"]')
    expect(toggle.attributes('disabled')).toBeUndefined()

    // Fire the click without awaiting — the handler will suspend on addIntent
    toggle.trigger('click')
    await wrapper.vm.$nextTick()
    expect(toggle.attributes('disabled')).toBeDefined()

    resolveAdd()
    await flushPromises()
    expect(toggle.attributes('disabled')).toBeUndefined()
  })
})