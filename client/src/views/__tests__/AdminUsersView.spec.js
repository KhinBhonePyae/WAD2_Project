import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'
import AdminUsersView from '../AdminUsersView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../utils/api.js', () => ({
  BASE_URL: 'http://api.test',
  authConfig: () => ({ headers: { Authorization: 'Bearer t' } }),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const mountView = () => mount(AdminUsersView)

const user = (id, extra = {}) => ({
  _id: id, name: `User ${id}`, email: `u${id}@test.com`,
  role: 'user', createdAt: '2026-01-01T00:00:00Z', ...extra,
})

// The component reads localStorage 'user' to decide who is "self"
function signedInAs(id) {
  localStorage.setItem('user', JSON.stringify({ _id: id, name: 'Me' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  signedInAs('999')
})

afterEach(() => vi.restoreAllMocks())

describe('AdminUsersView: loading and filtering', () => {
  it('loads the user list and shows the total count', async () => {
    axios.get.mockResolvedValue({
      data: { users: [user('1'), user('2', { role: 'admin' })] },
    })

    const wrapper = mountView()
    await flushPromises()

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/admin$/),
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(wrapper.find('.user-count').text()).toContain('2 users')
    expect(wrapper.findAll('.user-row')).toHaveLength(2)
  })

  it('filters by name/email and by role', async () => {
    axios.get.mockResolvedValue({
      data: {
        users: [
          user('1', { name: 'Alice', email: 'alice@x.com', role: 'admin' }),
          user('2', { name: 'Bob', email: 'bob@x.com', role: 'user' }),
        ],
      },
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.search-box input').setValue('bob')
    expect(wrapper.findAll('.user-row')).toHaveLength(1)

    await wrapper.find('.search-box input').setValue('')
    await wrapper.find('.filter-select').setValue('admin')
    expect(wrapper.findAll('.user-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('Alice')
  })

  it('shows "No users found" when filters exclude everyone', async () => {
    axios.get.mockResolvedValue({ data: { users: [user('1')] } })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.search-box input').setValue('zzzz')
    expect(wrapper.find('.empty-row').text()).toBe('No users found.')
  })

  it('paginates 10 per page', async () => {
    axios.get.mockResolvedValue({
      data: { users: Array.from({ length: 25 }, (_, i) => user(String(i + 1))) },
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.user-row')).toHaveLength(10)
    expect(wrapper.find('.pagination-section p').text()).toContain('1–10 of 25')
  })
})

describe('AdminUsersView: self-protection', () => {
  it('marks the current user with a "You" badge and disables their role select', async () => {
    axios.get.mockResolvedValue({
      data: { users: [user('999', { name: 'Me' }), user('1')] },
    })

    const wrapper = mountView()
    await flushPromises()

    const rows = wrapper.findAll('.user-row')
    expect(rows[0].find('.you-badge').exists()).toBe(true)
    expect(rows[0].find('.role-select').attributes('disabled')).toBeDefined()
    expect(rows[0].find('.action-btn').exists()).toBe(false)
    expect(rows[0].find('.protected-text').exists()).toBe(true)

    expect(rows[1].find('.you-badge').exists()).toBe(false)
    expect(rows[1].find('.action-btn').exists()).toBe(true)
  })
})

describe('AdminUsersView: role update', () => {
  it('PUTs the role and shows a success banner', async () => {
    axios.get.mockResolvedValue({ data: { users: [user('1')] } })
    axios.put.mockResolvedValue({ data: { user: { ...user('1'), role: 'admin' } } })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.role-select').setValue('admin')
    await flushPromises()

    expect(axios.put).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/admin\/1\/role$/),
      { role: 'admin' },
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(wrapper.find('.alert-success').text()).toContain('role was updated')
  })

  it('does not PUT when the selection matches the current role', async () => {
    axios.get.mockResolvedValue({ data: { users: [user('1')] } })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.role-select').setValue('user')
    await flushPromises()

    expect(axios.put).not.toHaveBeenCalled()
  })

  it('logs out and redirects to /login on 401', async () => {
    axios.get.mockResolvedValue({ data: { users: [user('1')] } })
    axios.put.mockRejectedValue({ response: { status: 401 } })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.role-select').setValue('admin')
    await flushPromises()

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(push).toHaveBeenCalledWith('/login')
  })
})

describe('AdminUsersView: delete modal', () => {
  it('opens on Delete, confirms, and removes the row', async () => {
    axios.get.mockResolvedValue({ data: { users: [user('1')] } })
    axios.delete.mockResolvedValue({ data: { message: 'Account deleted.' } })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.action-btn.delete-btn').trigger('click')
    expect(wrapper.find('.confirm-overlay').exists()).toBe(true)

    await wrapper.find('.confirm-delete').trigger('click')
    await flushPromises()

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/admin\/1$/),
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
    expect(wrapper.findAll('.user-row')).toHaveLength(0)
  })

  it('Cancel closes the modal without a request', async () => {
    axios.get.mockResolvedValue({ data: { users: [user('1')] } })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.action-btn.delete-btn').trigger('click')
    await wrapper.find('.confirm-cancel').trigger('click')

    expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
    expect(axios.delete).not.toHaveBeenCalled()
  })
})