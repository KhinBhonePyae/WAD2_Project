import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WeatherStrip from '../WeatherStrip.vue'

describe('WeatherStrip', () => {
  it('does not render if weather prop is missing', () => {
    const wrapper = mount(WeatherStrip, { props: { weather: null } })
    expect(wrapper.find('[data-test="weather"]').exists()).toBe(false)
  })

  it('renders correctly when it is raining', () => {
    const weather = { icon: '🌧️', label: 'Raining', temp: 26, raining: true }
    const wrapper = mount(WeatherStrip, { props: { weather, area: 'Singapore' } })
    
    expect(wrapper.text()).toContain('🌧️')
    expect(wrapper.text()).toContain('Raining in Singapore — 26°C')
    expect(wrapper.text()).toContain('Outdoor spots are ranked lower right now.')
  })

  it('renders correctly when it is NOT raining and defaults to Singapore', () => {
    const weather = { icon: '☀️', label: 'Sunny', temp: 32, raining: false }
    const wrapper = mount(WeatherStrip, { props: { weather } })
    
    expect(wrapper.text()).toContain('Sunny in Singapore — 32°C')
    expect(wrapper.text()).toContain('Good conditions for outdoor spots.')
  })
})