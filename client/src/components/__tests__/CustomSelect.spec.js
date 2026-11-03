import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomSelect from '../CustomSelect.vue'

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
]

describe('CustomSelect', () => {
  it('shows the selected option label', () => {
    const wrapper = mount(CustomSelect, { props: { modelValue: 'b', options } })
    expect(wrapper.find('.ss-select-trigger').text()).toContain('Option B')
  })

  it('falls back to the first option when nothing is selected', () => {
    const wrapper = mount(CustomSelect, { props: { modelValue: '', options } })
    expect(wrapper.find('.ss-select-trigger').text()).toContain('Option A')
  })

  it('opens the menu on click and closes it on a second click', async () => {
    const wrapper = mount(CustomSelect, { props: { modelValue: 'a', options } })
    await wrapper.find('.ss-select-trigger').trigger('click')
    expect(wrapper.find('.ss-select-menu').exists()).toBe(true)

    await wrapper.find('.ss-select-trigger').trigger('click')
    expect(wrapper.find('.ss-select-menu').exists()).toBe(false)
  })

  it('emits update:modelValue and closes on selection', async () => {
    const wrapper = mount(CustomSelect, { props: { modelValue: 'a', options } })
    await wrapper.find('.ss-select-trigger').trigger('click')
    const items = wrapper.findAll('.ss-select-item')
    await items[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['c'])
    expect(wrapper.find('.ss-select-menu').exists()).toBe(false)
  })

  it('marks the current option with is-active', async () => {
    const wrapper = mount(CustomSelect, { props: { modelValue: 'b', options } })
    await wrapper.find('.ss-select-trigger').trigger('click')
    const active = wrapper.findAll('.ss-select-item').find((i) => i.classes('is-active'))
    expect(active?.text()).toBe('Option B')
  })

  it('closes on an outside click', async () => {
    const wrapper = mount(CustomSelect, {
      props: { modelValue: 'a', options },
      attachTo: document.body,
    })
    await wrapper.find('.ss-select-trigger').trigger('click')
    expect(wrapper.find('.ss-select-menu').exists()).toBe(true)

    document.body.dispatchEvent(new Event('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ss-select-menu').exists()).toBe(false)
    wrapper.unmount()
  })
})