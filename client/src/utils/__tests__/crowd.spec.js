import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import axios from 'axios'
import {
  CROWD_LABELS, FRESH_MS,
  fetchPlaceCrowd, checkIn, fetchMyCheckin, undoCheckin,
  isFresh, timeAgo,
} from '../crowd.js'

// Fixed "now" for every time-based assertion
const NOW = new Date('2026-11-03T12:00:00Z').getTime()
const msAgo = (ms) => NOW - ms

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

/* -------------------------------------------------------------------------- */
/* isFresh                                                                    */
/* -------------------------------------------------------------------------- */
describe('crowd.isFresh', () => {
  it('treats a report from a moment ago as fresh', () => {
    expect(isFresh(new Date(msAgo(30_000)).toISOString(), NOW)).toBe(true)
  })

  it('is fresh at 1ms inside the window', () => {
    expect(isFresh(new Date(msAgo(FRESH_MS - 1)).toISOString(), NOW)).toBe(true)
  })

  it('is NOT fresh exactly at the boundary (strict <)', () => {
    expect(isFresh(new Date(msAgo(FRESH_MS)).toISOString(), NOW)).toBe(false)
  })

  it('is NOT fresh past the window', () => {
    expect(isFresh(new Date(msAgo(FRESH_MS + 1)).toISOString(), NOW)).toBe(false)
    expect(isFresh(new Date(msAgo(FRESH_MS * 24)).toISOString(), NOW)).toBe(false)
  })

  it('returns false for an invalid date', () => {
    expect(isFresh('not-a-date', NOW)).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* timeAgo                                                                    */
/* -------------------------------------------------------------------------- */
describe('crowd.timeAgo', () => {
  const ago = (ms) => new Date(msAgo(ms)).toISOString()

  it('says "just now" for < 1 minute', () => {
    expect(timeAgo(ago(0), NOW)).toBe('just now')
    expect(timeAgo(ago(59_999), NOW)).toBe('just now')
  })

  it('formats minutes', () => {
    expect(timeAgo(ago(60_000), NOW)).toBe('1 min ago')
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe('5 min ago')
    expect(timeAgo(ago(59 * 60_000), NOW)).toBe('59 min ago')
  })

  it('formats hours from 60 minutes up', () => {
    expect(timeAgo(ago(60 * 60_000), NOW)).toBe('1 h ago')
    expect(timeAgo(ago(2 * 60 * 60_000), NOW)).toBe('2 h ago')
    expect(timeAgo(ago(23 * 60 * 60_000), NOW)).toBe('23 h ago')
  })

  it('says "yesterday" from 24 to just under 48 hours', () => {
    expect(timeAgo(ago(24 * 60 * 60_000), NOW)).toBe('yesterday')
    expect(timeAgo(ago(47 * 60 * 60_000), NOW)).toBe('yesterday')
  })

  it('formats days between 2 and 29', () => {
    expect(timeAgo(ago(2 * 24 * 60 * 60_000), NOW)).toBe('2 days ago')
    expect(timeAgo(ago(29 * 24 * 60 * 60_000), NOW)).toBe('29 days ago')
  })

  it('falls back to a date string at 30 days or more', () => {
    const out = timeAgo(ago(30 * 24 * 60 * 60_000), NOW)
    expect(out).toMatch(/\d{4}/)              // contains a year
    expect(out).not.toMatch(/ago$/)           // not the relative format
  })

  it('returns an empty string for an invalid date', () => {
    expect(timeAgo('nope', NOW)).toBe('')
  })
})

/* -------------------------------------------------------------------------- */
/* API wrappers                                                               */
/* -------------------------------------------------------------------------- */
describe('crowd.fetchPlaceCrowd', () => {
  it('hits the right URL and returns the payload', async () => {
    axios.get.mockResolvedValue({ data: { latest: null, total: 0, counts: {} } })
    const out = await fetchPlaceCrowd(7)
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/crowd\/place\/7$/))
    expect(out).toEqual({ latest: null, total: 0, counts: {} })
  })
})

describe('crowd.checkIn', () => {
  it('POSTs the level with a Bearer auth header', async () => {
    localStorage.setItem('token', 't')
    axios.post.mockResolvedValue({ data: { ok: true } })

    await checkIn(7, 'quiet')

    const [url, body, config] = axios.post.mock.calls[0]
    expect(url).toMatch(/\/crowd\/7$/)
    expect(body).toEqual({ level: 'quiet' })
    expect(config).toEqual({ headers: { Authorization: 'Bearer t' } })
  })
})

describe('crowd.fetchMyCheckin', () => {
  it('returns null when logged out and never calls axios', async () => {
    expect(await fetchMyCheckin(7)).toBeNull()
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('returns the level when logged in', async () => {
    localStorage.setItem('token', 't')
    axios.get.mockResolvedValue({ data: { level: 'moderate' } })

    expect(await fetchMyCheckin(7)).toBe('moderate')
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/crowd\/mine\/7$/),
      { headers: { Authorization: 'Bearer t' } },
    )
  })

  it('swallows network errors and returns null', async () => {
    localStorage.setItem('token', 't')
    axios.get.mockRejectedValue(new Error('offline'))
    expect(await fetchMyCheckin(7)).toBeNull()
  })
})

describe('crowd.undoCheckin', () => {
  it('DELETEs with the auth header', async () => {
    localStorage.setItem('token', 't')
    axios.delete.mockResolvedValue({})
    await undoCheckin(7)
    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringMatching(/\/crowd\/7$/),
      { headers: { Authorization: 'Bearer t' } },
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */
describe('crowd.CROWD_LABELS', () => {
  it('maps every level to a user-friendly label', () => {
    expect(CROWD_LABELS).toEqual({ quiet: 'Quiet', moderate: 'Moderate', packed: 'Packed' })
  })
})