import { describe, it, expect, beforeEach } from 'vitest'
import { authConfig, BASE_URL } from '../api.js'

describe('api.authConfig', () => {
  beforeEach(() => localStorage.clear())

  it('returns an empty object when there is no token', () => {
    expect(authConfig()).toEqual({})
  })

  it('returns a Bearer header when a token is present', () => {
    localStorage.setItem('token', 'abc123')
    expect(authConfig()).toEqual({ headers: { Authorization: 'Bearer abc123' } })
  })
})

describe('api.BASE_URL', () => {
  it('is a non-empty string', () => {
    expect(typeof BASE_URL).toBe('string')
    expect(BASE_URL.length).toBeGreaterThan(0)
  })
})