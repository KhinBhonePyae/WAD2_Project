import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WorldChat from '../WorldChat.vue'

vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))
vi.mock('../../utils/motion.js', () => ({ reducedMotion: true }))

// The chat renders a <RouterLink to="/login"> in its error state. Without a
// real router, RouterLink's internal useLink() crashes — so export a stub that
// behaves like the real <a> and forwards clicks.
vi.mock('vue-router', () => {
  const push = vi.fn()
  return {
    useRouter: () => ({ push }),
    RouterLink: {
      name: 'RouterLink',
      props: { to: { type: [String, Object], default: '' } },
      emits: ['click'],
      template: `<a :href="typeof to === 'string' ? to : to?.path || '#'"
                    @click="$emit('click', $event)"><slot /></a>`,
    },
  }
})

const ok = (data) => ({ ok: true, status: 200, json: () => Promise.resolve(data) })
const err = (status, body) => ({ ok: false, status, json: () => Promise.resolve(body) })

const user = { id: 'u1', name: 'Alex' }
const btn = (w) => w.find('[data-test="world-chat-btn"]')

async function openChat(wrapper) {
  await btn(wrapper).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token')
  global.fetch = vi.fn().mockResolvedValue(ok({ messages: [] }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('WorldChat: gating', () => {
  it('renders nothing when there is no logged-in user', () => {
    const wrapper = mount(WorldChat, { props: { user: null } })
    expect(btn(wrapper).exists()).toBe(false)
  })

  it('hides its button while the assistant is open', async () => {
    const wrapper = mount(WorldChat, { props: { user } })
    window.dispatchEvent(new CustomEvent('floating-chat-open', { detail: 'assistant' }))
    await flushPromises()
    expect(btn(wrapper).exists()).toBe(false)

    window.dispatchEvent(new CustomEvent('floating-chat-close', { detail: 'assistant' }))
    await flushPromises()
    expect(btn(wrapper).exists()).toBe(true)
  })

  it('clears messages and closes when the user logs out', async () => {
    const wrapper = mount(WorldChat, { props: { user } })
    await openChat(wrapper)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    await wrapper.setProps({ user: null })
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('WorldChat: loading and sending', () => {
  it('fetches messages with the bearer token on open', async () => {
    global.fetch.mockResolvedValueOnce(ok({
      messages: [{ id: 'm1', author: 'Sam', text: 'Hello', createdAt: new Date().toISOString() }],
    }))
    const wrapper = mount(WorldChat, { props: { user } })
    await openChat(wrapper)

    expect(wrapper.text()).toContain('Hello')
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe('http://api.test/world-chat/messages')
    expect(opts.headers).toMatchObject({ Authorization: 'Bearer test-token' })
  })

  it('deduplicates messages that arrive on a poll and sorts by time', async () => {
    vi.useFakeTimers()
    const t1 = new Date(Date.now() - 60_000).toISOString()
    const t2 = new Date().toISOString()

    global.fetch
      .mockResolvedValueOnce(ok({
        messages: [
          { id: 'm1', author: 'A', text: 'first', createdAt: t2 },
          { id: 'm2', author: 'B', text: 'second', createdAt: t1 },
        ],
      }))
      .mockResolvedValueOnce(ok({
        messages: [
          { id: 'm1', author: 'A', text: 'first', createdAt: t2 },
          { id: 'm2', author: 'B', text: 'second', createdAt: t1 },
          { id: 'm3', author: 'C', text: 'third', createdAt: new Date().toISOString() },
        ],
      }))

    const wrapper = mount(WorldChat, { props: { user } })
    await openChat(wrapper)
    await vi.advanceTimersByTimeAsync(3500)
    await flushPromises()

    const articles = wrapper.findAll('.x-world-chat__message')
    expect(articles).toHaveLength(3)
    expect(articles[0].text()).toContain('second')
    expect(articles[2].text()).toContain('third')
  })

  it('posts a new message and appends it', async () => {
    global.fetch
      .mockResolvedValueOnce(ok({ messages: [] }))
      .mockResolvedValueOnce(ok({
        message: { id: 'm-new', author: 'Alex', text: 'hey', createdAt: new Date().toISOString() },
      }))

    const wrapper = mount(WorldChat, { props: { user } })
    await openChat(wrapper)
    await wrapper.find('.x-world-chat__input').setValue('hey')
    await wrapper.find('.x-world-chat__form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('hey')
    expect(wrapper.find('.x-world-chat__input').element.value).toBe('')

    const [, postOpts] = global.fetch.mock.calls[1]
    expect(JSON.parse(postOpts.body)).toEqual({ text: 'hey' })
  })

  it('shows a login link on a 401 during load', async () => {
    global.fetch.mockResolvedValueOnce(err(401, { error: 'expired' }))
    const wrapper = mount(WorldChat, { props: { user } })
    await openChat(wrapper)

    expect(wrapper.find('.x-world-chat__error').exists()).toBe(true)
    expect(wrapper.find('.x-world-chat__error').text()).toMatch(/log in again/i)
    expect(wrapper.find('a[href="/login"]').exists()).toBe(true)
  })

  it('surfaces a send error without clearing the draft', async () => {
    global.fetch
      .mockResolvedValueOnce(ok({ messages: [] }))
      .mockResolvedValueOnce(err(500, { error: 'Server is down.' }))

    const wrapper = mount(WorldChat, { props: { user } })
    await openChat(wrapper)
    await wrapper.find('.x-world-chat__input').setValue('hey')
    await wrapper.find('.x-world-chat__form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Server is down.')
    expect(wrapper.find('.x-world-chat__input').element.value).toBe('hey')
  })
})

describe('WorldChat: closing', () => {
  it('closes on Escape and on an outside press', async () => {
    const wrapper = mount(WorldChat, { props: { user }, attachTo: document.body })
    await openChat(wrapper)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await openChat(wrapper)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('stops polling once the panel is closed', async () => {
    vi.useFakeTimers()
    const wrapper = mount(WorldChat, { props: { user } })
    await openChat(wrapper)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await btn(wrapper).trigger('click')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})