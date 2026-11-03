import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterChips from '../FilterChips.vue'

describe('FilterChips', () => {
  const options = [
    { value: 'wifi', label: 'Wi-Fi' },
    { value: 'quiet', label: 'Quiet environment' }
  ]

  it('renders all provided options', () => {
    const wrapper = mount(FilterChips, { props: { options, selected: [] } })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toBe('Wi-Fi')
    expect(buttons[1].text()).toBe('Quiet environment')
  })

  it('applies aria-pressed=true to selected chips', () => {
    const wrapper = mount(FilterChips, { props: { options, selected: ['wifi'] } })
    
    const wifiChip = wrapper.get('[data-test="chip-wifi"]')
    const quietChip = wrapper.get('[data-test="chip-quiet"]')
    
    expect(wifiChip.attributes('aria-pressed')).toBe('true')
    expect(quietChip.attributes('aria-pressed')).toBe('false')
  })

  it('emits a toggle event with the correct value when clicked', async () => {
    const wrapper = mount(FilterChips, { props: { options, selected: [] } })
    
    await wrapper.get('[data-test="chip-quiet"]').trigger('click')
    
    expect(wrapper.emitted()).toHaveProperty('toggle')
    expect(wrapper.emitted('toggle')[0]).toEqual(['quiet'])
  })
})