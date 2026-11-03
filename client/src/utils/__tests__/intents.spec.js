import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import axios from 'axios'
import {
  LEVEL_LABELS, LEVEL_BADGES,
  fetchPlaceIntents, fetchMyIntents,
  addIntent, removeIntent,
} from '../intents.js'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('intents.fetchPlaceIntents', () => {
  it('hits the right URL and returns .slots', async () => {
    axios.get.mockResolvedValue({ data: { slots: [{ slot: 'morning' }] } })
    const out = await fetchPlaceIntents(42)
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/intents\/place\/42$/))
    expect(out).toEqual([{ slot: 'morning' }])
  })
})

describe('intents.fetchMyIntents', () => {
  it('returns [] and never calls axios when logged out', async () => {
    expect(await fetchMyIntents()).toEqual([])
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('returns .intents with the auth header when logged in', async () => {
    localStorage.setItem('token', 't')
    axios.get.mockResolvedValue({ data: { intents: [{ placeId: 1 }] } })

    expect(await fetchMyIntents()).toEqual([{ placeId: 1 }])
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/intents\/mine$/),
      { headers: { Authorization: 'Bearer t' } },
    )
  })

  it('logs and returns [] on a network error', async () => {
    localStorage.setItem('token', 't')
    axios.get.mockRejectedValue(new Error('offline'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await fetchMyIntents()).toEqual([])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('intents.addIntent', () => {
  it('POSTs { date, slot } with auth', async () => {
    localStorage.setItem('token', 't')
    axios.post.mockResolvedValue({})

    await addIntent(42, '2026-11-04', 'morning')

    const [url, body, config] = axios.post.mock.calls[0]
    expect(url).toMatch(/\/intents\/42$/)
    expect(body).toEqual({ date: '2026-11-04', slot: 'morning' })
    expect(config).toEqual({ headers: { Authorization: 'Bearer t' } })
  })
})

describe('intents.removeIntent', () => {
  it('DELETEs with params for date and slot plus auth header', async () => {
    localStorage.setItem('token', 't')
    axios.delete.mockResolvedValue({})

    await removeIntent(42, '2026-11-04', 'morning')

    const [url, config] = axios.delete.mock.calls[0]
    expect(url).toMatch(/\/intents\/42$/)
    expect(config).toEqual({
      headers: { Authorization: 'Bearer t' },
      params: { date: '2026-11-04', slot: 'morning' },
    })
  })
})

describe('intents labels', () => {
  it('exposes deterministic labels', () => {
    expect(LEVEL_LABELS).toEqual({
      quiet: 'Likely quiet',
      filling: 'Filling up',
      packed: 'Likely packed',
    })
  })

  it('exposes a badge class per level', () => {
    expect(Object.keys(LEVEL_BADGES).sort()).toEqual(['filling', 'packed', 'quiet'])
  })
})