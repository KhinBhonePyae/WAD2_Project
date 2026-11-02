import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import axios from 'axios'
import ForgotPasswordView from '../ForgotPasswordView.vue'

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}))

function mountView() {
  return mount(ForgotPasswordView, {
    global: {
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>'
        }
      }
    }
  })
}

describe('ForgotPasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays the email field and send reset link button', () => {
    const wrapper = mountView()

    expect(wrapper.find('#email').exists()).toBe(true)
    expect(wrapper.text()).toContain('Send reset link')
  })

  it('shows an error when email is empty', async () => {
    const wrapper = mountView()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Please enter your email address.')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('shows a success message when reset request succeeds', async () => {
    const message =
      'If an account exists for this email, a password reset link has been sent.'

    axios.post.mockResolvedValue({
      data: { message }
    })

    const wrapper = mountView()

    await wrapper.find('#email').setValue('student@example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/users/forgot-password'),
      {
        email: 'student@example.com'
      }
    )

    expect(wrapper.text()).toContain(message)
  })

  it('shows the backend error when the reset request fails', async () => {
    axios.post.mockRejectedValue({
      response: {
        data: {
          error: 'Unable to send reset link'
        }
      }
    })

    const wrapper = mountView()

    await wrapper.find('#email').setValue('student@example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to send reset link')
  })
})