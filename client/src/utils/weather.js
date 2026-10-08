/* Open-Meteo - free, no API key, no sign-up, 10,000 calls/day.
 * Owner: Liew Tian Le (weather integration + AI assistant).
 * Docs: https://open-meteo.com/en/docs
 */
import axios from 'axios'

const SG = { lat: 1.2966, lon: 103.8521 }   // city centre fallback

export async function fetchWeather(lat = SG.lat, lon = SG.lon) {
  const url = 'https://api.open-meteo.com/v1/forecast'
  const { data } = await axios.get(url, {
    params: { latitude: lat, longitude: lon, current: 'temperature_2m,precipitation,weather_code' },
  })
  const c = data.current
  const code = c.weather_code
  const raining = c.precipitation > 0 || (code >= 51 && code <= 99)
  return {
    temp: Math.round(c.temperature_2m),
    precipitation: c.precipitation,
    code,
    raining,
    fair: !raining && code <= 2,
    label: describe(code, raining),
    icon: icon(code, raining),
  }
}

function describe(code, raining) {
  if (raining) return 'Raining'
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Mostly sunny'
  if (code === 3) return 'Overcast'
  if (code >= 45 && code <= 48) return 'Foggy'
  return 'Cloudy'
}
function icon(code, raining) {
  if (raining) return '\u{1F327}'
  if (code === 0) return '☀️'
  if (code <= 2) return '\u{1F324}'
  return '☁️'
}
