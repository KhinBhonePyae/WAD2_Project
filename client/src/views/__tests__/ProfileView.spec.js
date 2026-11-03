import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'
import ProfileView from '../ProfileView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))
vi.mock('../../utils/studySpots.js', () => ({
  STUDY_SPOTS: [
    { key: 'indoor', label: 'Indoor', emoji: '🏢', note: 'Air-con' },
    { key: 'cafe',   label: 'Café',   emoji: '☕', note: 'Buzz' },
  ],
}))
vi.mock('../../utils/saved.js', () => ({
  fetchSavedIds: vi.fn(() => Promise.resolve([])),
}))

const push = vi.fn()
let routeQuery = {}
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: routeQuery }),
}))

const mountView = () => mount(ProfileView)

const profile = (extra = {}) => ({
  _id: 'u1', name: 'Alex', email: 'a@b.com',
  createdAt: '2025-01-15T00:00:00Z',
  preferences: {
    wifiRequired: false, socketsRequired: false, quietPreferred: false,
    indoorPreferred: false, studySpots: [],
  },
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  routeQuery = {}
  localStorage.setItem('token', 't')
  axios.get.mockResolvedValue({ data: profile() })
})

afterEach(() => vi.restoreAllMocks())

async function mountAndEdit() {
  const wrapper = mountView()
  await flushPromises()
  await wrapper.find('.edit-button').trigger('click')
  return wrapper
}

async function mountAndOpenPasswordModal() {
  const wrapper = mountView()
  await flushPromises()
  await wrapper.find('.password-button').trigger('click')
  return wrapper
}

async function mountAndOpenDeleteModal() {
  const wrapper = mountView()
  await flushPromises()
  await wrapper.find('.delete-button').trigger('click')
  return wrapper
}

describe('ProfileView: loading', () => {
  it('redirects to /login without a token', async () => {
    localStorage.removeItem('token')
    mountView()
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/login')
  })

  it('loads the profile and shows name/email/initials', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Alex')
    expect(wrapper.text()).toContain('a@b.com')
    expect(wrapper.find('.profile-avatar').text()).toBe('A')
  })

  it('shows the stored preferences on the profile card', async () => {
    axios.get.mockResolvedValue({
      data: profile({ preferences: { wifiRequired: true, studySpots: ['cafe'] } }),
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Required')
    expect(wrapper.text()).toContain('Preferred')
  })

  it('auto-opens the edit view when ?edit=1', async () => {
    routeQuery = { edit: '1' }
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('.edit-card').exists()).toBe(true)
  })

  it('logs out and redirects on a 401 while loading', async () => {
    localStorage.setItem('user', '{"name":"Alex"}')
    axios.get.mockRejectedValue({ response: { status: 401 } })
    mountView()
    await flushPromises()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(push).toHaveBeenCalledWith('/login')
  })
})

describe('ProfileView: editing', () => {
  it('Cancel discards local changes', async () => {
    const wrapper = await mountAndEdit()
    await wrapper.find('#name').setValue('Changed')
    await wrapper.findAll('button').find((b) => b.text() === 'Cancel').trigger('click')
    expect(wrapper.find('#name').exists()).toBe(false)
    await wrapper.find('.edit-button').trigger('click')
    expect(wrapper.find('#name').element.value).toBe('Alex')
  })

  it('refuses to save an empty name', async () => {
    const wrapper = await mountAndEdit()
    await wrapper.find('#name').setValue('  ')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.find('.alert-danger').text()).toContain('Name is required')
    expect(axios.put).not.toHaveBeenCalled()
  })

  it('PUTs the trimmed name and preferences, then updates storage', async () => {
    axios.put.mockResolvedValue({
      data: { user: { ...profile(), name: 'Alexandra' } },
    })
    const handler = vi.fn()
    window.addEventListener('user-login', handler)
    const wrapper = await mountAndEdit()
    await wrapper.find('#name').setValue('  Alexandra  ')
    await wrapper.find('[data-test="edit-spot-indoor"]').trigger('click')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    const [url, body] = axios.put.mock.calls[0]
    expect(url).toMatch(/\/users\/profile$/)
    expect(body).toMatchObject({
      name: 'Alexandra',
      preferences: { indoorPreferred: true, studySpots: ['indoor'] },
    })
    expect(JSON.parse(localStorage.getItem('user')).name).toBe('Alexandra')
    expect(handler).toHaveBeenCalled()
    expect(wrapper.find('.alert-success').text()).toContain('Profile updated')
    window.removeEventListener('user-login', handler)
  })
})

describe('ProfileView: change password', () => {
  it('rejects empty fields', async () => {
    const wrapper = await mountAndOpenPasswordModal()
    await wrapper.find('.profile-modal-card form').trigger('submit.prevent')
    expect(wrapper.find('.profile-modal-card .alert-danger').text())
      .toContain('All password fields are required')
  })

  it('rejects mismatched new passwords', async () => {
    const wrapper = await mountAndOpenPasswordModal()
    await wrapper.find('#currentPassword').setValue('oldpass')
    await wrapper.find('#newPassword').setValue('newpass12')
    await wrapper.find('#confirmPassword').setValue('newpass99')
    await wrapper.find('.profile-modal-card form').trigger('submit.prevent')
    expect(wrapper.find('.profile-modal-card .alert-danger').text()).toContain('do not match')
  })

  it('rejects short new passwords', async () => {
    const wrapper = await mountAndOpenPasswordModal()
    await wrapper.find('#currentPassword').setValue('oldpass')
    await wrapper.find('#newPassword').setValue('short')
    await wrapper.find('#confirmPassword').setValue('short')
    await wrapper.find('.profile-modal-card form').trigger('submit.prevent')
    expect(wrapper.find('.profile-modal-card .alert-danger').text())
      .toContain('at least 8 characters')
  })

  it('PUTs the password and shows the server success message', async () => {
    axios.put.mockResolvedValue({ data: { message: 'Password changed.' } })
    const wrapper = await mountAndOpenPasswordModal()
    await wrapper.find('#currentPassword').setValue('oldpass')
    await wrapper.find('#newPassword').setValue('newpass123')
    await wrapper.find('#confirmPassword').setValue('newpass123')
    await wrapper.find('.profile-modal-card form').trigger('submit.prevent')
    await flushPromises()
    expect(axios.put).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/profile\/password$/),
      { currentPassword: 'oldpass', newPassword: 'newpass123', confirmPassword: 'newpass123' },
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(wrapper.find('.profile-modal-card .alert-success').text()).toBe('Password changed.')
  })
})

describe('ProfileView: delete account', () => {
  it('requires a password', async () => {
    const wrapper = await mountAndOpenDeleteModal()
    await wrapper.find('.profile-modal-card .btn-danger').trigger('click')
    expect(wrapper.find('.profile-modal-card .alert-danger').text())
      .toContain('Please enter your password')
    expect(axios.delete).not.toHaveBeenCalled()
  })

  it('DELETEs the account, clears storage, and redirects home', async () => {
    localStorage.setItem('user', '{"name":"Alex"}')
    axios.delete.mockResolvedValue({})
    const wrapper = await mountAndOpenDeleteModal()
    await wrapper.find('#deletePassword').setValue('secret')
    await wrapper.find('.profile-modal-card .btn-danger').trigger('click')
    await flushPromises()
    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/profile$/),
      expect.objectContaining({ data: { password: 'secret' } }),
    )
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(push).toHaveBeenCalledWith('/')
  })
})

describe('ProfileView: logout', () => {
  it('clears storage and dispatches user-login', async () => {
    const handler = vi.fn()
    window.addEventListener('user-login', handler)
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-test="logout"]').trigger('click')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(handler).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/')
    window.removeEventListener('user-login', handler)
  })
})