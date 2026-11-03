import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CrowdMeter from '../CrowdMeter.vue'

describe('CrowdMeter', () => {
  it('renders "No reports" and no modifier class when level is empty', () => {
    const wrapper = mount(CrowdMeter)
    expect(wrapper.text()).toContain('No reports')
    expect(wrapper.find('[data-test="crowd"]').classes()).not.toContain('ss-crowd--quiet')
  })

  it('renders "Quiet" with the correct class', () => {
    const wrapper = mount(CrowdMeter, { props: { level: 'quiet' } })
    expect(wrapper.text()).toContain('Quiet')
    expect(wrapper.find('[data-test="crowd"]').classes()).toContain('ss-crowd--quiet')
  })

  it('renders "Moderate" with the correct class', () => {
    const wrapper = mount(CrowdMeter, { props: { level: 'moderate' } })
    expect(wrapper.text()).toContain('Moderate')
    expect(wrapper.find('[data-test="crowd"]').classes()).toContain('ss-crowd--moderate')
  })

  it('renders "Packed" with the correct class', () => {
    const wrapper = mount(CrowdMeter, { props: { level: 'packed' } })
    expect(wrapper.text()).toContain('Packed')
    expect(wrapper.find('[data-test="crowd"]').classes()).toContain('ss-crowd--packed')
  })
})