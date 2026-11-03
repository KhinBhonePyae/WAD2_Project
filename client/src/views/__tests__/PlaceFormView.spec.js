import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import axios from 'axios'
import PlaceFormView from '../PlaceFormView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({
  BASE_URL: 'http://api.test',
  authConfig: () => ({ headers: { Authorization: 'Bearer t' } }),
}))

const push = vi.fn()
let routeParams = {}
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams }),
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot/></a>' },
}))

const mountView = () =>
  mount(PlaceFormView, { global: { stubs: { RouterLink: RouterLinkStub } } })

async function fillValid(wrapper) {
  await wrapper.find('input[placeholder="e.g. Li Ka Shing Library"]').setValue('Central Library')
  await wrapper.find('input[placeholder="e.g. Bras Basah"]').setValue('Bras Basah')
  await wrapper.find('input[placeholder="e.g. 70 Stamford Rd, Singapore 178901"]').setValue('100 Victoria St')
  await wrapper.findAll('input[type="number"]')[0].setValue('1.2966')
  await wrapper.findAll('input[type="number"]')[1].setValue('103.85')
  await wrapper.findAll('input[type="time"]')[0].setValue('09:00')
  await wrapper.findAll('input[type="time"]')[1].setValue('21:00')
  await wrapper.findAll('input[placeholder^="https://example.com/photo"]')[0].setValue('https://img.test/a.jpg')
  await wrapper.find('textarea').setValue('Quiet, sunny, plenty of sockets.')
}

beforeEach(() => {
  vi.clearAllMocks()
  routeParams = {}
  window.scrollTo = vi.fn()
})

describe('PlaceFormView: validation (create mode)', () => {
  it('reports every missing required field', async () => {
    const wrapper = mountView()
    await wrapper.find('form').trigger('submit.prevent')

    const list = wrapper.find('.form-errors').text()
    expect(list).toContain('Name is required')
    expect(list).toContain('Area is required')
    expect(list).toContain('Address is required')
    expect(list).toContain('Latitude is required')
    expect(list).toContain('Longitude is required')
    expect(list).toContain('Opening time is required')
    expect(list).toContain('Closing time is required')
    expect(list).toContain('At least one photo is required')
    expect(list).toContain('Description is required')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('rejects out-of-range latitude and longitude', async () => {
    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.findAll('input[type="number"]')[0].setValue('999')
    await wrapper.findAll('input[type="number"]')[1].setValue('-999')
    await wrapper.find('form').trigger('submit.prevent')

    const list = wrapper.find('.form-errors').text()
    expect(list).toContain('Latitude must be between -90 and 90')
    expect(list).toContain('Longitude must be between -180 and 180')
  })

  it('rejects a closing time that is not later than opening', async () => {
    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.findAll('input[type="time"]')[0].setValue('21:00')
    await wrapper.findAll('input[type="time"]')[1].setValue('09:00')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('.form-errors').text()).toContain('Closing time must be later than opening time')
  })

  it('rejects an invalid photo URL', async () => {
    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.findAll('input[placeholder^="https://example.com/photo"]')[0].setValue('not-a-url')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('.form-errors').text()).toContain('Photo URL 1 must be a valid http or https URL')
  })

  it('rejects a capacity outside 1–5000', async () => {
    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.find('[data-test="capacity-input"]').setValue('9999')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('.form-errors').text()).toContain('Capacity must be a whole number between 1 and 5000')
  })

  it('does not require times when the place is temporarily closed', async () => {
    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.findAll('.form-select').find((s) => s.text().includes('Temporarily closed')).setValue('temporary')
    await wrapper.findAll('input[type="time"]')[0].setValue('')
    await wrapper.findAll('input[type="time"]')[1].setValue('')
    axios.post.mockResolvedValue({ data: { id: 42 } })

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.form-errors').exists()).toBe(false)
    expect(axios.post).toHaveBeenCalled()
  })
})

describe('PlaceFormView: create', () => {
  it('POSTs the trimmed payload and redirects to the new place', async () => {
    axios.post.mockResolvedValue({ data: { id: 42 } })

    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.find('input[placeholder="e.g. Li Ka Shing Library"]').setValue('   Central Library  ')
    await wrapper.find('[data-test="capacity-input"]').setValue('50')
    await wrapper.find('[data-test="entry-select"]').setValue('free')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const [url, body, config] = axios.post.mock.calls[0]
    expect(url).toMatch(/\/places$/)
    expect(body).toMatchObject({
      name: 'Central Library',
      address: '100 Victoria St',
      area: 'Bras Basah',
      lat: 1.2966,
      lon: 103.85,
      hours: '09:00 - 21:00',
      entry: 'free',
      capacity: 50,
      closureStatus: 'normal',
      photos: ['https://img.test/a.jpg'],
    })
    expect(config).toEqual({ headers: { Authorization: 'Bearer t' } })
    expect(push).toHaveBeenCalledWith('/places/42')
  })

  it('sends capacity: null when the field is left empty', async () => {
    axios.post.mockResolvedValue({ data: { id: 1 } })

    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(axios.post.mock.calls[0][1].capacity).toBeNull()
  })

  it('shows the server error on failure', async () => {
    axios.post.mockRejectedValue({ response: { data: { error: 'Name already exists.' } } })

    const wrapper = mountView()
    await fillValid(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.form-errors').text()).toContain('Name already exists.')
  })
})

describe('PlaceFormView: edit', () => {
  beforeEach(() => {
    routeParams = { id: '7' }
    axios.get.mockResolvedValue({
      data: {
        id: 7, name: 'Existing', area: 'Bugis', address: '1 Beach Rd',
        lat: 1.3, lon: 103.85, hours: '09:00 - 21:00', indoor: true,
        closureStatus: 'normal', markedOpen: true, openNow: true,
        description: 'Nice place.', capacity: 40, entry: 'free',
        facilities: ['wifi', 'sockets'],
        photos: ['https://img.test/1.jpg', 'https://img.test/2.jpg'],
      },
    })
  })

  it('loads the existing values into the form', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/places\/7$/))
    expect(wrapper.find('input[placeholder="e.g. Li Ka Shing Library"]').element.value).toBe('Existing')
    expect(wrapper.find('[data-test="capacity-input"]').element.value).toBe('40')
  })

  it('PUTs to the existing place and redirects on save', async () => {
    axios.put.mockResolvedValue({ data: { id: 7 } })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(axios.put).toHaveBeenCalledWith(
      expect.stringMatching(/\/places\/7$/),
      expect.objectContaining({ name: 'Existing' }),
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(push).toHaveBeenCalledWith('/places/7')
  })

  it('keeps extra imported photos when saving', async () => {
    axios.get.mockResolvedValue({
      data: {
        id: 7,
        name: 'Central Library',
        area: 'Bras Basah',
        address: '100 Victoria St',
        lat: 1.2966,
        lon: 103.85,
        hours: '09:00 - 21:00',
        description: 'Quiet, sunny, plenty of sockets.',
        photos: [
          'https://a.test/1.jpg', 'https://a.test/2.jpg', 'https://a.test/3.jpg',
          'https://a.test/4.jpg', 'https://a.test/5.jpg',
        ],
      },
    })
    axios.put.mockResolvedValue({ data: { id: 7 } })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(axios.put).toHaveBeenCalledTimes(1)
    expect(axios.put.mock.calls[0][1].photos).toEqual([
      'https://a.test/1.jpg', 'https://a.test/2.jpg', 'https://a.test/3.jpg',
      'https://a.test/4.jpg', 'https://a.test/5.jpg',
    ])
  })
})