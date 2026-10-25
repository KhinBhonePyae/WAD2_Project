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

const place = { id:1, name:'Li Ka Shing Library' }

function mountReport() {
  return mount(ReportIssue, { props:{ place } })
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
      path:'/login',
      query:{ redirect:'/places/1' }
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

    expect(wrapper.text()).toContain(
      'Choose what information is incorrect.'
    )

    await wrapper.find('#reportCategory').setValue('hours')
    await wrapper.find('#reportMessage').setValue('bad')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain(
      'Please give a little more detail.'
    )

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('submits a valid report and shows success', async () => {
    localStorage.setItem('token', 'test-token')

    mockPost.mockResolvedValue({
      data:{ message:'Report submitted successfully.' }
    })

    const wrapper = mountReport()

    await wrapper.find('.report-trigger').trigger('click')
    await wrapper.find('#reportCategory').setValue('hours')
    await wrapper.find('#reportMessage')
      .setValue('The library now closes at 9pm.')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockPost).toHaveBeenCalled()

    expect(mockPost.mock.calls[0][1]).toEqual({
      placeId:1,
      category:'hours',
      message:'The library now closes at 9pm.'
    })

    expect(wrapper.text()).toContain('Report sent')
    expect(wrapper.text()).toContain(
      'Report submitted successfully.'
    )
  })
})