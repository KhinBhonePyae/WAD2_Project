import { describe, it, expect, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import PlaceCard from '../PlaceCard.vue'

vi.mock('../../utils/motion.js', () => ({
  gsap: { context: vi.fn(() => ({ revert: vi.fn() })), quickTo: vi.fn(() => vi.fn()), fromTo: vi.fn() },
  finePointer: false,
  reducedMotion: true,
}))
vi.mock('../../utils/intents.js', () => ({
  LEVEL_LABELS: { quiet: 'Quiet', moderate: 'Moderate', packed: 'Packed' },
}))
vi.mock('../../utils/suitability.js', () => ({
  ENTRY_LABELS: { free: 'Free entry', paid: 'Paid entry' },
}))

const base = {
  id: 7, name: 'Central Library', area: 'Bras Basah', hours: '9am–9pm',
  openNow: true, entry: 'free', rating: 4.5, reviewCount: 12,
  photos: ['/img.jpg'], intent: null,
}

const mountCard = (place, extra = {}) =>
  mount(PlaceCard, {
    props: { place, saved: false, ...extra },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })

describe('PlaceCard', () => {
  it('renders the details and open state', () => {
    const wrapper = mountCard(base)
    const text = wrapper.text()
    expect(text).toContain('Central Library')
    expect(text).toContain('Bras Basah')
    expect(text).toContain('Free entry')
    expect(text).toContain('open now')
    expect(wrapper.find('.xc-status--open').exists()).toBe(true)
  })

  it('flags closed places and adds the closed class for greyscale', () => {
    const wrapper = mountCard({ ...base, openNow: false })
    expect(wrapper.find('.xc--closed').exists()).toBe(true)
    expect(wrapper.find('.xc-status--closed').text()).toBe('closed')
  })

  it('emits toggle-save with the place id', async () => {
    const wrapper = mountCard(base)
    await wrapper.find('[data-test="fav"]').trigger('click')
    expect(wrapper.emitted('toggle-save')?.[0]).toEqual([7])
  })

  // NEW: the default (unsaved) heart state before anyone clicks it
  it('shows the default unsaved heart state', () => {
    const wrapper = mountCard(base, { saved: false })
    const fav = wrapper.find('[data-test="fav"]')
    expect(fav.attributes('aria-pressed')).toBe('false')
    expect(fav.attributes('aria-label')).toBe('Save this place')
  })

  it('reflects the saved state on the heart button', () => {
    const wrapper = mountCard(base, { saved: true })
    const fav = wrapper.find('[data-test="fav"]')
    expect(fav.attributes('aria-pressed')).toBe('true')
    expect(fav.attributes('aria-label')).toBe('Remove from saved')
  })

  it('renders the extra tags when provided', () => {
    const wrapper = mountCard(base, { tags: ['📍 350 m away', '★ Your pick'] })
    const tags = wrapper.findAll('[data-test="card-tag"]')
    expect(tags).toHaveLength(2)
    expect(tags[0].text()).toBe('📍 350 m away')
  })

  it('renders the intent pill with the correct plural and day', () => {
    const wrapper = mountCard({
      ...base,
      intent: { count: 3, day: 'Today', label: 'Afternoon', level: 'moderate' },
    })
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('heading here this afternoon')
    expect(wrapper.text()).toContain('Moderate')
  })
})