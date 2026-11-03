import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import axios from 'axios'
import AdminPlacesView from '../AdminPlacesView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({
  BASE_URL: 'http://api.test',
  authConfig: () => ({ headers: { Authorization: 'Bearer t' } }),
}))
vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot/></a>' },
}))

const mountView = () =>
  mount(AdminPlacesView, { global: { stubs: { RouterLink: RouterLinkStub } } })

const place = (id, name, extra = {}) => ({
  id, name, area: 'Bugis', address: `${name} St`,
  openNow: true, hours: '9am–9pm', indoor: true,
  photos: [], ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  global.confirm = vi.fn(() => true)
})

describe('AdminPlacesView: loading and stats', () => {
  it('loads places and shows total/open/closed counts', async () => {
    axios.get.mockResolvedValue({
      data: [
        place(1, 'Alpha', { openNow: true }),
        place(2, 'Beta', { openNow: false }),
        place(3, 'Gamma', { openNow: true }),
      ],
    })

    const wrapper = mountView()
    await flushPromises()

    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/places$/))
    const text = wrapper.text()
    expect(text).toContain('3')   // total
    expect(text).toContain('2')   // open
    expect(text).toContain('1')   // closed
  })

  it('shows an error state when the load fails', async () => {
    axios.get.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.admin-empty').text()).toContain('No study spaces')
    vi.restoreAllMocks()
  })
})

describe('AdminPlacesView: search and sort', () => {
  const list = [place(1, 'Zebra'), place(2, 'Apple'), place(3, 'Mango')]

  it('filters by name, area, or address (case-insensitive)', async () => {
    axios.get.mockResolvedValue({ data: list })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.admin-search input').setValue('man')
    const rows = wrapper.findAll('.admin-place-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Mango')
  })

  it('sorts A–Z by default and Z–A on change', async () => {
    axios.get.mockResolvedValue({ data: list })
    const wrapper = mountView()
    await flushPromises()

    const names = () => wrapper.findAll('.admin-place-name').map((w) => w.text())
    expect(names()).toEqual(['Apple', 'Mango', 'Zebra'])

    await wrapper.find('.admin-sort').setValue('za')
    expect(names()).toEqual(['Zebra', 'Mango', 'Apple'])
  })

  it('resets to page 1 when the search or sort changes', async () => {
    const many = Array.from({ length: 15 }, (_, i) => place(i + 1, `Place ${String(i + 1).padStart(2, '0')}`))
    axios.get.mockResolvedValue({ data: many })

    const wrapper = mountView()
    await flushPromises()

    // Move to page 2
    const pageButtons = wrapper.findAll('.pagination-btn:not(.pagination-arrow)')
    await pageButtons[1].trigger('click')
    expect(wrapper.findAll('.admin-place-row')).toHaveLength(5)   // 15 - 10

    await wrapper.find('.admin-search input').setValue('Place')
    expect(wrapper.findAll('.admin-place-row')).toHaveLength(10)  // page 1
  })
})

describe('AdminPlacesView: pagination', () => {
  it('paginates 10 per page and shows "Showing X–Y of N"', async () => {
    const many = Array.from({ length: 25 }, (_, i) => place(i + 1, `P${i + 1}`))
    axios.get.mockResolvedValue({ data: many })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.admin-place-row')).toHaveLength(10)
    expect(wrapper.find('.admin-page-info').text()).toContain('Showing 1–10 of 25')

    const next = wrapper.find('.pagination-arrow[aria-label="Next page"]')
    await next.trigger('click')
    expect(wrapper.find('.admin-page-info').text()).toContain('Showing 11–20 of 25')
  })

  it('hides the pagination when there is only one page', async () => {
    axios.get.mockResolvedValue({ data: [place(1, 'Solo')] })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.admin-pagination').exists()).toBe(false)
  })
})

describe('AdminPlacesView: delete', () => {
  it('asks for confirmation, then deletes and removes the row', async () => {
    axios.get.mockResolvedValue({ data: [place(1, 'Alpha'), place(2, 'Beta')] })
    axios.delete.mockResolvedValue({})

    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('.admin-actions .btn-outline-danger')[0].trigger('click')
    await flushPromises()

    expect(global.confirm).toHaveBeenCalled()
    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringMatching(/\/places\/1$/),
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(wrapper.findAll('.admin-place-row')).toHaveLength(1)
  })

  it('leaves the row alone when the user cancels', async () => {
    axios.get.mockResolvedValue({ data: [place(1, 'Alpha')] })
    global.confirm = vi.fn(() => false)

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.admin-actions .btn-outline-danger').trigger('click')
    await flushPromises()

    expect(axios.delete).not.toHaveBeenCalled()
    expect(wrapper.findAll('.admin-place-row')).toHaveLength(1)
  })
})

describe('AdminPlacesView: closure badges', () => {
  it('shows the "Temporarily closed" / "Permanently closed" badges', async () => {
    axios.get.mockResolvedValue({
      data: [
        place(1, 'A', { closureStatus: 'temporary' }),
        place(2, 'B', { hours: 'Permanently closed' }),
        place(3, 'C', { hours: '9am–9pm' }),
      ],
    })

    const wrapper = mountView()
    await flushPromises()

    const rows = wrapper.findAll('.admin-place-row')
    expect(rows[0].text()).toContain('Temporarily closed')
    expect(rows[1].text()).toContain('Permanently closed')
    expect(rows[2].text()).toContain('9am–9pm')
  })
})