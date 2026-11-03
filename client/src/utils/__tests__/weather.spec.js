import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

import axios from 'axios'
import { fetchWeather } from '../weather.js'

// Helper — build a fake Open-Meteo "current" payload
function current(overrides = {}) {
  return {
    temperature_2m: 30,
    precipitation: 0,
    weather_code: 0,
    is_day: 1,
    ...overrides,
  }
}

async function run(payload) {
  axios.get.mockResolvedValue({ data: { current: payload } })
  return fetchWeather()
}

beforeEach(() => vi.clearAllMocks())

describe('weather.fetchWeather', () => {
  it('calls Open-Meteo with the required params', async () => {
    await run(current())
    const [url, config] = axios.get.mock.calls[0]
    expect(url).toBe('https://api.open-meteo.com/v1/forecast')
    expect(config.params).toEqual({
      latitude: expect.any(Number),
      longitude: expect.any(Number),
      current: 'temperature_2m,precipitation,weather_code,is_day',
    })
  })

  it('rounds the temperature', async () => {
    const out = await run(current({ temperature_2m: 30.6 }))
    expect(out.temp).toBe(31)
  })

  it('clear code 0, dry, daytime', async () => {
    const out = await run(current({ weather_code: 0, is_day: 1 }))
    expect(out).toMatchObject({
      kind: 'clear', label: 'Clear', fair: true, raining: false, isDay: true,
    })
    expect(out.icon).toBe('☀️')
  })

  it('partly cloudy 1–2', async () => {
    const out = await run(current({ weather_code: 1 }))
    expect(out.kind).toBe('partly')
    expect(out.label).toBe('Mostly sunny')
    expect(out.fair).toBe(true)
  })

  it('cloudy code 3', async () => {
    const out = await run(current({ weather_code: 3 }))
    expect(out.kind).toBe('cloudy')
    expect(out.label).toBe('Overcast')
    expect(out.fair).toBe(false)
  })

  it('foggy 45–48 is cloudy kind', async () => {
    const out = await run(current({ weather_code: 45 }))
    expect(out.kind).toBe('cloudy')
    expect(out.label).toBe('Foggy')
  })

  it('rain code 61 is raining + rain kind + drops fair', async () => {
    const out = await run(current({ weather_code: 61, precipitation: 1.2 }))
    expect(out.kind).toBe('rain')
    expect(out.label).toBe('Raining')
    expect(out.raining).toBe(true)
    expect(out.fair).toBe(false)
  })

  it('thunderstorm code 95', async () => {
    const out = await run(current({ weather_code: 95, precipitation: 5 }))
    expect(out.label).toBe('Thunderstorm')
    expect(out.kind).toBe('rain')
    expect(out.raining).toBe(true)
  })

  it('precipitation > 0 counts as raining even with a clear code', async () => {
    const out = await run(current({ weather_code: 0, precipitation: 0.2 }))
    expect(out.raining).toBe(true)
    expect(out.kind).toBe('rain')
    expect(out.fair).toBe(false)
  })

  it('isDay is driven by is_day === 1', async () => {
    expect((await run(current({ is_day: 1 }))).isDay).toBe(true)
    expect((await run(current({ is_day: 0 }))).isDay).toBe(false)
  })

  it('does not mutate the returned precipitation/code', async () => {
    const out = await run(current({ weather_code: 3, precipitation: 0 }))
    expect(out.code).toBe(3)
    expect(out.precipitation).toBe(0)
  })
})