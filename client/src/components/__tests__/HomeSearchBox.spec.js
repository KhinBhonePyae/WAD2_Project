import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeSearchBox from '../HomeSearchBox.vue'

const places = [
  { id: 1, name: 'Bugis Library', area: 'Bugis', rating: 4.5, openNow: true },
  { id: 2, name: 'SMU Library', area: 'Bras Basah', rating: 4.8, openNow: true },
  { id: 3, name: 'Tampines Study Hub', area: 'Tampines', rating: 4.0, openNow: false, tags: ['Bugis-adjacent'] },
  { id: 4, name: 'Bugis Junction Café', area: 'Bugis', rating: 4.2, openNow: true },
]

const input = (w) => w.find('[data-test="hero-search"]')

async function focusWith(wrapper, value) {
  await wrapper.setProps({ modelValue: value })
  await input(wrapper).trigger('focus')
  await wrapper.vm.$nextTick()
}

describe('HomeSearchBox: suggestions', () => {
  it('shows no list when the term is empty', () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    expect(wrapper.find('[data-test="suggest-list"]').exists()).toBe(false)
  })

  it('ranks name-prefix hits above name-substring hits above area/tag hits', async () => {
    // "Bugis Library" starts with "bugis" -> tier 3
    // "Bugis Junction Café" starts with "bugis" -> tier 3 (tie → higher rating first)
    // "Tampines Study Hub" has a tag hit -> tier 1
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    await focusWith(wrapper, 'bugis')

    const items = wrapper.findAll('[data-test="suggest-item"]')
    expect(items.map((i) => i.find('.suggest__name').text())).toEqual([
      'Bugis Library',
      'Bugis Junction Café',
      'Tampines Study Hub',
    ])
  })

  it('caps the list at `max`', async () => {
    const wrapper = mount(HomeSearchBox, {
      props: { modelValue: '', places, max: 2 },
    })
    await focusWith(wrapper, 'bugis')
    expect(wrapper.findAll('[data-test="suggest-item"]')).toHaveLength(2)
  })

  it('wraps each matched substring in a <mark>', async () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    await focusWith(wrapper, 'bugis')
    const marks = wrapper.findAll('.suggest__name mark')
    expect(marks.length).toBeGreaterThan(0)
    expect(marks[0].text().toLowerCase()).toBe('bugis')
  })

  it('shows the empty state with the raw query', async () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    await focusWith(wrapper, 'zzzz')
    expect(wrapper.find('[data-test="suggest-empty"]').text()).toContain('zzzz')
    expect(wrapper.find('[data-test="suggest-all"]').exists()).toBe(true)
  })
})

describe('HomeSearchBox: keyboard', () => {
  it('moves the active row with ArrowDown / ArrowUp and wraps', async () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    await focusWith(wrapper, 'bugis')

    const press = (key) => input(wrapper).trigger('keydown', { key })

    await press('ArrowDown')
    expect(wrapper.find('[data-test="suggest-item"]').attributes('aria-selected')).toBe('true')

    await press('ArrowUp') // wraps to last
    const items = wrapper.findAll('[data-test="suggest-item"]')
    expect(items[items.length - 1].attributes('aria-selected')).toBe('true')
  })

  it('enters the active suggestion on Enter', async () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    await focusWith(wrapper, 'bugis')

    await input(wrapper).trigger('keydown', { key: 'ArrowDown' })
    await input(wrapper).trigger('keydown', { key: 'ArrowDown' })
    await input(wrapper).trigger('keydown', { key: 'Enter' })

    const selected = wrapper.emitted('select')?.[0]?.[0]
    expect(selected.id).toBe(4) // second item = Bugis Junction Café (rating tie-break)
  })

  it('emits "search" on Enter when nothing is active', async () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    await focusWith(wrapper, 'bugis')
    await input(wrapper).trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('search')?.[0]).toEqual(['bugis'])
  })

  it('closes the list on Escape', async () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: '', places } })
    await focusWith(wrapper, 'bugis')
    expect(wrapper.find('[data-test="suggest-list"]').exists()).toBe(true)

    await input(wrapper).trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-test="suggest-list"]').exists()).toBe(false)
  })
})

describe('HomeSearchBox: search button', () => {
  it('emits "search" with the current value when clicked', async () => {
    const wrapper = mount(HomeSearchBox, { props: { modelValue: 'SMU', places } })
    await wrapper.find('[data-test="hero-search-btn"]').trigger('click')
    expect(wrapper.emitted('search')?.[0]).toEqual(['SMU'])
  })
})