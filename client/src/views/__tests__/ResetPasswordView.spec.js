import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import axios from 'axios'
import ResetPasswordView from '../ResetPasswordView.vue'

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      token: 'test-reset-token'
    }
  }),

  RouterLink: {
    template: '<a><slot /></a>'
  }
}))

function mountView() {
  return mount(ResetPasswordView)
}

describe('ResetPasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays the new password and confirm password fields', () => {
    const wrapper = mountView()

    expect(wrapper.find('#newPassword').exists()).toBe(true)
    expect(wrapper.find('#confirmPassword').exists()).toBe(true)
    expect(wrapper.text()).toContain('Reset password')
  })

  it('shows an error when password fields are empty', async () => {
    const wrapper = mountView()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Please complete both password fields.')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('shows an error when passwords do not match', async () => {
    const wrapper = mountView()

    await wrapper.find('#newPassword').setValue('new-password-123')
    await wrapper.find('#confirmPassword').setValue('different-password-123')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Passwords do not match.')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('shows a success message when password reset succeeds', async () => {
    axios.post.mockResolvedValue({
      data: {
        message: 'Password reset successfully'
      }
    })

    const wrapper = mountView()

    await wrapper.find('#newPassword').setValue('new-password-123')
    await wrapper.find('#confirmPassword').setValue('new-password-123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining(
        '/users/reset-password/test-reset-token'
      ),
      {
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123'
      }
    )

    expect(wrapper.text()).toContain('Password reset successfully')
  })

  it('shows an error when the reset token is invalid or expired', async () => {
    axios.post.mockRejectedValue({
      response: {
        data: {
          error: 'Password reset link is invalid or has expired'
        }
      }
    })

    const wrapper = mountView()

    await wrapper.find('#newPassword').setValue('new-password-123')
    await wrapper.find('#confirmPassword').setValue('new-password-123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain(
      'Password reset link is invalid or has expired'
    )
  })
})