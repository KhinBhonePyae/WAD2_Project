import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import axios from 'axios'
import { isLoggedIn, fetchSavedIds, toggleSavedId } from '../saved.js'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('saved.isLoggedIn', () => {
  it('is false without a token', () => {
    expect(isLoggedIn()).toBe(false)
  })
  it('is true with a token', () => {
    localStorage.setItem('token', 't')
    expect(isLoggedIn()).toBe(true)
  })
})

describe('saved.fetchSavedIds', () => {
  it('returns [] and never calls axios when logged out', async () => {
    expect(await fetchSavedIds()).toEqual([])
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('returns .savedPlaceIds when logged in', async () => {
    localStorage.setItem('token', 't')
    axios.get.mockResolvedValue({ data: { savedPlaceIds: [1, 2, 3] } })

    expect(await fetchSavedIds()).toEqual([1, 2, 3])
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/saved$/),
      { headers: { Authorization: 'Bearer t' } },
    )
  })

  it('returns [] and logs on error', async () => {
    localStorage.setItem('token', 't')
    axios.get.mockRejectedValue(new Error('offline'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await fetchSavedIds()).toEqual([])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('saved.toggleSavedId', () => {
  beforeEach(() => localStorage.setItem('token', 't'))

  it('DELETEs an already-saved id and returns the list without it', async () => {
    axios.delete.mockResolvedValue({})

    const out = await toggleSavedId([1, 2, 3], 2)

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringMatching(/\/saved\/2$/),
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(axios.post).not.toHaveBeenCalled()
    expect(out).toEqual([1, 3])
  })

  it('POSTs a new id and returns the list with it appended', async () => {
    axios.post.mockResolvedValue({})

    const out = await toggleSavedId([1, 3], 2)

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/saved\/2$/),
      {},
      { headers: { Authorization: 'Bearer t' } },
    )
    expect(axios.delete).not.toHaveBeenCalled()
    expect(out).toEqual([1, 3, 2])
  })

  it('does not mutate the input array', async () => {
    axios.post.mockResolvedValue({})
    const original = [1, 3]
    await toggleSavedId(original, 2)
    expect(original).toEqual([1, 3])
  })
})