import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchQueryBar from '../SearchQueryBar.vue'

describe('SearchQueryBar', () => {
  it('syncs the input with the modelValue prop', async () => {
    const wrapper = mount(SearchQueryBar, { props: { modelValue: 'initial' } })
    const input = wrapper.get('[data-test="search-input"]')
    
    expect(input.element.value).toBe('initial')
    
    await wrapper.setProps({ modelValue: 'updated from parent' })
    expect(input.element.value).toBe('updated from parent')
  })

  it('emits update:modelValue and search when the button is clicked', async () => {
    const wrapper = mount(SearchQueryBar, { props: { modelValue: 'Bugis' } })
    
    await wrapper.get('[data-test="search-button"]').trigger('click')
    
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['Bugis'])
    expect(wrapper.emitted()).toHaveProperty('search')
  })

  it('trims whitespace before emitting', async () => {
    const wrapper = mount(SearchQueryBar, { props: { modelValue: '  SMU  ' } })
    
    await wrapper.get('[data-test="search-button"]').trigger('click')
    
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['SMU']) // Trimmed!
  })

  it('triggers search on Enter key up', async () => {
    const wrapper = mount(SearchQueryBar, { props: { modelValue: 'Library' } })
    const input = wrapper.get('[data-test="search-input"]')
    
    await input.trigger('keyup.enter')
    
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['Library'])
    expect(wrapper.emitted()).toHaveProperty('search')
  })
})