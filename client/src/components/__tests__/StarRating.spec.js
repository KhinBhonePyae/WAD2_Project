import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StarRating from '../StarRating.vue'

describe('StarRating', () => {
  it('shows the stars, average and review count', () => {
    const wrapper = mount(StarRating, { props: { value: 4.4, count: 12 } })
    expect(wrapper.text()).toContain('★★★★☆')
    expect(wrapper.text()).toContain('4.4 (12)')
  })

  it('says "No reviews yet" for a place without reviews', () => {
    const wrapper = mount(StarRating, { props: { value: 0, count: 0 } })
    expect(wrapper.text()).toBe('No reviews yet')
  })

  it('shows only stars for a single review (no count given)', () => {
    const wrapper = mount(StarRating, { props: { value: 3 } })
    expect(wrapper.text()).toBe('★★★☆☆')
  })
})
