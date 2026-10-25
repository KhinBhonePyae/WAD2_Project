import { describe, it, expect } from 'vitest'
import { timeAgo, isFresh } from '../crowd.js'

const NOW = new Date('2026-10-25T12:00:00+08:00').getTime()
const ago = (ms) => new Date(NOW - ms).toISOString()
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('timeAgo', () => {
  it('says "just now" for under a minute', () => {
    expect(timeAgo(ago(20 * 1000), NOW)).toBe('just now')
  })

  it('counts minutes, then hours', () => {
    expect(timeAgo(ago(25 * MIN), NOW)).toBe('25 min ago')
    expect(timeAgo(ago(3 * HOUR), NOW)).toBe('3 h ago')
  })

  it('counts days, with "yesterday" for one day', () => {
    expect(timeAgo(ago(DAY + HOUR), NOW)).toBe('yesterday')
    expect(timeAgo(ago(4 * DAY), NOW)).toBe('4 days ago')
  })

  it('shows a date for anything older than a month', () => {
    expect(timeAgo(ago(45 * DAY), NOW)).toMatch(/2026/)
  })

  it('returns nothing for a bad date', () => {
    expect(timeAgo('not a date', NOW)).toBe('')
  })
})

describe('isFresh', () => {
  it('treats reports from the last two hours as "right now"', () => {
    expect(isFresh(ago(90 * MIN), NOW)).toBe(true)
    expect(isFresh(ago(3 * HOUR), NOW)).toBe(false)
  })
})
