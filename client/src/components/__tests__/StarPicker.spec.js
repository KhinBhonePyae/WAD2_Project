import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StarPicker from '../StarPicker.vue'

describe('StarPicker', () => {
  it('lights up stars up to the current rating', () => {
    const wrapper = mount(StarPicker, { props: { modelValue: 3 } })
    expect(wrapper.findAll('.star.on')).toHaveLength(3)
    expect(wrapper.find('[data-test="star-3"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('Good')
  })

  it('sets the rating when a star is tapped', async () => {
    const wrapper = mount(StarPicker, { props: { modelValue: 5 } })
    await wrapper.find('[data-test="star-2"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([2])
  })

  it('moves the rating with the arrow keys, between 1 and 5', async () => {
    const wrapper = mount(StarPicker, { props: { modelValue: 5 } })
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    await wrapper.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[5], [4]])
  })
})
