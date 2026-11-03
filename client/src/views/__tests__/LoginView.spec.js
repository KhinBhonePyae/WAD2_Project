import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import axios from 'axios'
import LoginView from '../LoginView.vue'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot/></a>' },
}))

function mountView() {
  return mount(LoginView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

async function fill(wrapper, email = 'a@b.com', password = 'secret123') {
  await wrapper.find('#email').setValue(email)
  await wrapper.find('#password').setValue(password)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => vi.restoreAllMocks())

describe('LoginView', () => {
  it('validates empty fields without hitting the API', async () => {
    const wrapper = mountView()
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('[data-test="auth-error"]').text()).toContain('Please enter your email and password')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('posts credentials, stores the token + user, fires user-login, and redirects', async () => {
    axios.post.mockResolvedValue({
      data: { token: 'tok_123', user: { _id: 'u1', name: 'Alex' } },
    })

    const handler = vi.fn()
    window.addEventListener('user-login', handler)

    const wrapper = mountView()
    await fill(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const [url, body] = axios.post.mock.calls[0]
    expect(url).toMatch(/\/users\/login$/)
    expect(body).toEqual({ email: 'a@b.com', password: 'secret123' })

    expect(localStorage.getItem('token')).toBe('tok_123')
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ _id: 'u1', name: 'Alex' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/')

    window.removeEventListener('user-login', handler)
  })

  it('shows the server error message on a 401', async () => {
    axios.post.mockRejectedValue({ response: { data: { error: 'Invalid credentials.' } } })

    const wrapper = mountView()
    await fill(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-test="auth-error"]').text()).toBe('Invalid credentials.')
    expect(localStorage.getItem('token')).toBeNull()
    expect(push).not.toHaveBeenCalled()
  })

  it('falls back to a friendly message when the server has no error text', async () => {
    axios.post.mockRejectedValue(new Error('network'))

    const wrapper = mountView()
    await fill(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-test="auth-error"]').text()).toContain('Unable to log in')
  })

  it('disables the submit button while logging in', async () => {
    let resolve
    axios.post.mockImplementation(() => new Promise((r) => { resolve = r }))

    const wrapper = mountView()
    await fill(wrapper)
    wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    const btn = wrapper.find('[data-test="login-submit"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain('Logging in')

    resolve({ data: { token: 't', user: {} } })
    await flushPromises()
  })
})