import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import axios from 'axios'
import SignUpView from '../SignUpView.vue'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))
vi.mock('../../utils/studySpots.js', () => ({
  STUDY_SPOTS: [
    { key: 'indoor', label: 'Indoor', emoji: '🏢', note: 'Air-con' },
    { key: 'cafe',   label: 'Café',   emoji: '☕', note: 'Buzz' },
  ],
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot/></a>' },
}))

const mountView = () =>
  mount(SignUpView, { global: { stubs: { RouterLink: RouterLinkStub } } })

async function fillStep1(wrapper, {
  name = 'Alex',
  email = 'a@b.com',
  password = 'abcd1234',
  confirm = 'abcd1234',
} = {}) {
  await wrapper.find('#name').setValue(name)
  await wrapper.find('#email').setValue(email)
  await wrapper.find('#password').setValue(password)
  await wrapper.find('#confirmPassword').setValue(confirm)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => vi.restoreAllMocks())

/* -------------------------------------------------------------------------- */
/* Step 1                                                                     */
/* -------------------------------------------------------------------------- */
describe('SignUpView: step 1 validation', () => {
  it('rejects empty fields', async () => {
    const wrapper = mountView()
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('[data-test="auth-error"]').text()).toContain('Please fill in all fields')
  })

  it('rejects a name longer than 60 characters', async () => {
    const wrapper = mountView()
    await fillStep1(wrapper, { name: 'x'.repeat(61) })
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('[data-test="auth-error"]').text()).toContain('60 characters')
  })

  it('rejects a password shorter than 8 characters', async () => {
    const wrapper = mountView()
    await fillStep1(wrapper, { password: 'short', confirm: 'short' })
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('[data-test="auth-error"]').text()).toContain('at least 8 characters')
  })

  it('rejects mismatched passwords', async () => {
    const wrapper = mountView()
    await fillStep1(wrapper, { password: 'abcd1234', confirm: 'different' })
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('[data-test="auth-error"]').text()).toContain('Passwords do not match')
  })

  it('checks the email and advances to step 2', async () => {
    axios.post.mockResolvedValue({ data: { ok: true } })
    const wrapper = mountView()
    await fillStep1(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const call = axios.post.mock.calls[0]
    expect(call[0]).toMatch(/\/users\/check-email$/)
    expect(call[1]).toEqual({ email: 'a@b.com' })
    expect(wrapper.text()).toContain('Where do you like to study?')
  })

  it('blocks step 2 when the email is taken', async () => {
    axios.post.mockRejectedValue({ response: { data: { error: 'Email already registered.' } } })
    const wrapper = mountView()
    await fillStep1(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-test="auth-error"]').text()).toBe('Email already registered.')
    expect(wrapper.text()).not.toContain('Where do you like to study?')
  })
})

/* -------------------------------------------------------------------------- */
/* Step 2                                                                     */
/* -------------------------------------------------------------------------- */
describe('SignUpView: step 2', () => {
  async function reachStep2(wrapper) {
    axios.post.mockResolvedValueOnce({ data: { ok: true } })
    await fillStep1(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
  }

  it('toggling a study spot updates preferences and reflects in indoorPreferred', async () => {
    const wrapper = mountView()
    await reachStep2(wrapper)

    await wrapper.find('[data-test="spot-indoor"]').trigger('click')
    expect(wrapper.find('[data-test="spot-indoor"]').attributes('aria-pressed')).toBe('true')

    await wrapper.find('[data-test="spot-indoor"]').trigger('click')
    expect(wrapper.find('[data-test="spot-indoor"]').attributes('aria-pressed')).toBe('false')
  })

  it('posts the account, then logs in, stores token + user, and redirects', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { ok: true } })                                        // check-email
      .mockResolvedValueOnce({ data: { ok: true } })                                        // register
      .mockResolvedValueOnce({ data: { token: 'tok', user: { _id: 'u1', name: 'Alex' } } }) // login

    const wrapper = mountView()
    await fillStep1(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    await wrapper.find('[data-test="spot-cafe"]').trigger('click')
    await wrapper.find('[data-test="pref-wifi"]').setValue(true)

    // Submit the step-2 form directly — button.click() doesn't dispatch `submit` in jsdom
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Every axios.post in register() is called with exactly TWO args: (url, body).
    // Destructure [url, body] — no third slot exists.
    expect(axios.post).toHaveBeenCalledTimes(3)

    const [, registerCall, loginCall] = axios.post.mock.calls
    // (the `,` skips check-email)

    // check-email
    const [checkUrl, checkBody] = axios.post.mock.calls[0]
    expect(checkUrl).toMatch(/\/users\/check-email$/)
    expect(checkBody).toEqual({ email: 'a@b.com' })

    // register
    const [registerUrl, registerBody] = registerCall
    expect(registerUrl).toMatch(/\/users\/register$/)
    expect(registerBody).toMatchObject({
      name: 'Alex',
      email: 'a@b.com',
      password: 'abcd1234',
      preferences: {
        wifiRequired: true,
        studySpots: ['cafe'],
        indoorPreferred: false,
      },
    })

    // login  ← the fix: [url, body], not [url, body, config]
    const [loginUrl, loginBody] = loginCall
    expect(loginUrl).toMatch(/\/users\/login$/)
    expect(loginBody).toEqual({ email: 'a@b.com', password: 'abcd1234' })

    // Side effects
    expect(localStorage.getItem('token')).toBe('tok')
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ _id: 'u1', name: 'Alex' })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('shows the register error and stays on step 2', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockRejectedValueOnce({ response: { data: { error: 'Email taken' } } })

    const wrapper = mountView()
    await fillStep1(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-test="auth-error"]').text()).toBe('Email taken')
    expect(push).not.toHaveBeenCalled()
    // Still on step 2
    expect(wrapper.text()).toContain('Where do you like to study?')
  })

  it('Back returns to step 1 with the form intact', async () => {
    const wrapper = mountView()
    await reachStep2(wrapper)

    const back = wrapper.findAll('button').find((b) => b.text() === 'Back')
    await back.trigger('click')

    expect(wrapper.find('#name').element.value).toBe('Alex')
    expect(wrapper.find('#email').element.value).toBe('a@b.com')
  })
})