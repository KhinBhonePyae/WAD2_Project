// Shared sky logic for the weather effects (Browse background and nav bar).
// previewSky is a TESTING switch: '' = live weather, or 'clear' | 'cloudy' | 'rain' | 'night'.
import { ref } from 'vue'

export const previewSky = ref('')

// clear | cloudy | rain | night (same mapping as WeatherScene)
export function skyOf(weather, preview = '') {
  if (preview) return preview
  if (!weather) return 'clear'
  if (weather.kind === 'rain') return 'rain'
  if (!weather.isDay) return 'night'
  return weather.kind === 'clear' ? 'clear' : 'cloudy'
}

export const SKY_ICONS = { clear: '☀️', cloudy: '☁️', rain: '🌧', night: '🌙' }
