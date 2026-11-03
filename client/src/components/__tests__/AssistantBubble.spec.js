import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistantBubble from '../AssistantBubble.vue'

// Fake the API calls, keep everything else real.
vi.mock('../../utils/api.js', () => ({ BASE_URL: 'http://api.test' }))

// The component reads `reducedMotion` for the <Transition> name — pin it so
// the test doesn't depend on the OS setting.
vi.mock('../../utils/motion.js', () => ({ reducedMotion: true }))

const ok = (data) => ({ ok: true, status: 200, json: () => Promise.resolve(data) })
const err = (status, body) => ({ ok: false, status, json: () => Promise.resolve(body) })

const btn = (w) => w.find('[data-test="assistant-btn"]')
const input = (w) => w.find('.x-assist__input')
const form = (w) => w.find('.x-assist__form')
const dialog = (w) => w.find('[role="dialog"]')

async function openChat(wrapper) {
  await btn(wrapper).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AssistantBubble: open / close', () => {
  it('starts closed and toggles open, with aria-expanded mirrored', async () => {
    const wrapper = mount(AssistantBubble)
    expect(dialog(wrapper).exists()).toBe(false)
    expect(btn(wrapper).attributes('aria-expanded')).toBe('false')

    await openChat(wrapper)
    expect(dialog(wrapper).exists()).toBe(true)
    expect(btn(wrapper).attributes('aria-expanded')).toBe('true')

    await btn(wrapper).trigger('click')
    expect(dialog(wrapper).exists()).toBe(false)
    expect(btn(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('broadcasts floating-chat-open / close so sibling chats can react', async () => {
    const opened = vi.fn()
    const closed = vi.fn()
    window.addEventListener('floating-chat-open', opened)
    window.addEventListener('floating-chat-close', closed)

    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    expect(opened).toHaveBeenCalledTimes(1)
    expect(opened.mock.calls[0][0].detail).toBe('assistant')

    await btn(wrapper).trigger('click')
    expect(closed).toHaveBeenCalledTimes(1)
    expect(closed.mock.calls[0][0].detail).toBe('assistant')

    window.removeEventListener('floating-chat-open', opened)
    window.removeEventListener('floating-chat-close', closed)
  })

  it('closes itself when another floating chat opens', async () => {
    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    expect(dialog(wrapper).exists()).toBe(true)

    window.dispatchEvent(new CustomEvent('floating-chat-open', { detail: 'world-chat' }))
    await flushPromises()
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('closes on Escape', async () => {
    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('closes on a click outside the root', async () => {
    const wrapper = mount(AssistantBubble, { attachTo: document.body })
    await openChat(wrapper)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(dialog(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('AssistantBubble: messaging', () => {
  it('appends the user message, posts it with history, and appends the reply', async () => {
    global.fetch.mockResolvedValueOnce(ok({ reply: 'Try the SMU library at 3pm.' }))

    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    await input(wrapper).setValue('Where should I study?')
    await form(wrapper).trigger('submit.prevent')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Where should I study?')
    expect(text).toContain('Try the SMU library at 3pm.')
    expect(input(wrapper).element.value).toBe('')

    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe('http://api.test/ai/study-assistant')
    expect(opts.method).toBe('POST')
    // The greeting is stripped from history.
    expect(JSON.parse(opts.body)).toEqual({
      userPrompt: 'Where should I study?',
      history: [],
    })
  })

  it('sends the last 10 messages of history on subsequent turns', async () => {
    // Seed 12 turns, then a final call: history must be capped at 10.
    for (let i = 1; i <= 12; i++) {
      global.fetch.mockResolvedValueOnce(ok({ reply: `reply-${i}` }))
    }

    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    for (let i = 1; i <= 12; i++) {
      await input(wrapper).setValue(`msg-${i}`)
      await form(wrapper).trigger('submit.prevent')
      await flushPromises()
    }

    const lastBody = JSON.parse(global.fetch.mock.calls.at(-1)[1].body)
    expect(lastBody.userPrompt).toBe('msg-12')
    expect(lastBody.history).toHaveLength(10)
    expect(lastBody.history[0]).toEqual({ role: 'user', text: 'msg-7' })
  })

  it('does not send an empty or whitespace-only message', async () => {
    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    await input(wrapper).setValue('   ')
    await form(wrapper).trigger('submit.prevent')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows the friendly "not switched on" message for a 503', async () => {
    global.fetch.mockResolvedValueOnce(err(503, { error: 'no key' }))

    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    await input(wrapper).setValue('hi')
    await form(wrapper).trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toMatch(/isn’t switched on yet/)
  })

  it('shows the server-provided error for other non-2xx responses', async () => {
    global.fetch.mockResolvedValueOnce(err(500, { error: 'Boom.' }))

    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    await input(wrapper).setValue('hi')
    await form(wrapper).trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.x-assist__message--error').text()).toBe('Boom.')
  })

  it('treats an empty reply as an error rather than a blank bubble', async () => {
    global.fetch.mockResolvedValueOnce(ok({ reply: '   ' }))

    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    await input(wrapper).setValue('hi')
    await form(wrapper).trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.x-assist__message--error').exists()).toBe(true)
    expect(wrapper.find('.x-assist__message--error').text()).toMatch(/couldn’t reach/)
  })

  it('reveals suggestions only before the first user message', async () => {
    const wrapper = mount(AssistantBubble)
    await openChat(wrapper)
    expect(wrapper.findAll('.x-assist__suggestion').length).toBeGreaterThan(0)

    const first = wrapper.findAll('.x-assist__suggestion')[0]
    await first.trigger('click')
    expect(input(wrapper).element.value).toBe(first.text())

    global.fetch.mockResolvedValueOnce(ok({ reply: 'ok' }))
    await form(wrapper).trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.findAll('.x-assist__suggestion').length).toBe(0)
  })
})