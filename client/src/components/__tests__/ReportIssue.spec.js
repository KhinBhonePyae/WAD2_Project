import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { mockPush, mockPost } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPost: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush })
}))

vi.mock('axios', () => ({
  default: { post: mockPost }
}))

import ReportIssue from '../ReportIssue.vue'

const place = { id: 1, name: 'Li Ka Shing Library' }

function mountReport() {
  return mount(ReportIssue, { props: { place } })
}

async function fillAndSubmit(wrapper, category = 'hours', message = 'The library now closes at 9pm.') {
  await wrapper.find('.report-trigger').trigger('click')
  await wrapper.find('#reportCategory').setValue(category)
  await wrapper.find('#reportMessage').setValue(message)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('ReportIssue', () => {
  beforeEach(() => {
    localStorage.clear()
    mockPush.mockReset()
    mockPost.mockReset()
  })

  it('redirects a logged-out user to login', async () => {
    const wrapper = mountReport()
    await wrapper.find('.report-trigger').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/places/1' }
    })
    expect(wrapper.find('.report-overlay').exists()).toBe(false)
  })

  it('opens the report modal for a logged-in user', async () => {
    localStorage.setItem('token', 'test-token')
    const wrapper = mountReport()
    await wrapper.find('.report-trigger').trigger('click')

    expect(wrapper.find('.report-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Li Ka Shing Library')
  })

  it('validates the category and message', async () => {
    localStorage.setItem('token', 'test-token')
    const wrapper = mountReport()
    await wrapper.find('.report-trigger').trigger('click')

    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Choose what information is incorrect.')

    await wrapper.find('#reportCategory').setValue('hours')
    await wrapper.find('#reportMessage').setValue('bad')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Please give a little more detail.')

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('submits a valid report and shows success', async () => {
    localStorage.setItem('token', 'test-token')
    mockPost.mockResolvedValue({ data: { message: 'Report submitted successfully.' } })

    const wrapper = mountReport()
    await fillAndSubmit(wrapper, 'hours', 'The library now closes at 9pm.')

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [url, body, config] = mockPost.mock.calls[0]
    expect(url).toMatch(/\/reports$/)
    expect(body).toEqual({
      placeId: 1,
      category: 'hours',
      message: 'The library now closes at 9pm.'
    })
    expect(config).toMatchObject({
      headers: { Authorization: 'Bearer test-token' }
    })

    expect(wrapper.text()).toContain('Report sent')
    expect(wrapper.text()).toContain('Report submitted successfully.')
  })

  it('logs the user out and redirects to /login on a 401', async () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', '{"name":"Alex"}')
    mockPost.mockRejectedValue({ response: { status: 401 } })

    const wrapper = mountReport()
    await fillAndSubmit(wrapper, 'hours', 'Closes earlier now.')

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(mockPush).toHaveBeenCalledWith('/login')
    expect(wrapper.text()).not.toContain('Report sent')
  })

  // NEW: the 401 also broadcasts user-login so other components can react
  it('dispatches the user-login event when logging out after a 401', async () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', '{"name":"Alex"}')
    mockPost.mockRejectedValue({ response: { status: 401 } })

    const handler = vi.fn()
    window.addEventListener('user-login', handler)

    const wrapper = mountReport()
    await fillAndSubmit(wrapper, 'hours', 'Closes earlier now.')

    expect(handler).toHaveBeenCalledTimes(1)

    window.removeEventListener('user-login', handler)
  })

  it('surfaces the server error for other failures', async () => {
    localStorage.setItem('token', 'test-token')
    mockPost.mockRejectedValue({
      response: { status: 400, data: { error: 'You already reported this.' } }
    })

    const wrapper = mountReport()
    await fillAndSubmit(wrapper, 'hours', 'Closes earlier now.')

    expect(wrapper.find('.alert-danger').text()).toContain('You already reported this.')
  })

  it('closes the dialog from the Cancel button', async () => {
    localStorage.setItem('token', 'test-token')

    const wrapper = mountReport()
    await wrapper.find('.report-trigger').trigger('click')
    expect(wrapper.find('.report-overlay').exists()).toBe(true)

    await wrapper.findAll('button')
      .find((b) => b.text() === 'Cancel')
      .trigger('click')

    expect(wrapper.find('.report-overlay').exists()).toBe(false)
  })
})