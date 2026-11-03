import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SuitabilityScore from '../SuitabilityScore.vue'
import { scoreBand } from '../../utils/suitability.js'

// Mock the external utility
vi.mock('../../utils/suitability.js', () => ({
  scoreBand: vi.fn()
}))

describe('SuitabilityScore', () => {
  it('applies the correct class based on scoreBand', () => {
    scoreBand.mockReturnValue('good')
    
    const wrapper = mount(SuitabilityScore, { props: { score: 85 } })
    const scoreEl = wrapper.get('[data-test="score"]')
    
    expect(scoreEl.classes()).toContain('ss-score--good')
    expect(scoreBand).toHaveBeenCalledWith(85)
  })

  it('renders the score and title attributes correctly', () => {
    scoreBand.mockReturnValue('average')
    
    const wrapper = mount(SuitabilityScore, { props: { score: 65 } })
    const scoreEl = wrapper.get('[data-test="score"]')
    
    expect(scoreEl.find('.ss-score__val').text()).toBe('65')
    expect(scoreEl.attributes('title')).toBe('Suitability 65 out of 100')
    // Check the dynamic CSS variable
    expect(scoreEl.attributes('style')).toContain('--ss-score: 65')
  })
})