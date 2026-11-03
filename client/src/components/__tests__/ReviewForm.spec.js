import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewForm from '../ReviewForm.vue'

describe('ReviewForm', () => {
  it('shows the author line', () => {
    const wrapper = mount(ReviewForm, {
      props: { placeId: 1, busy: false, authorName: 'Alex' },
    })
    expect(wrapper.find('[data-test="rv-author"]').text()).toContain('Alex')
  })

  it('emits submit-review with rating, comment, crowd and placeId', async () => {
    const wrapper = mount(ReviewForm, {
      props: { placeId: 9, busy: false, authorName: 'Sam' },
    })
    await wrapper.find('[data-test="star-4"]').trigger('click')
    await wrapper.find('[data-test="rv-crowd"]').setValue('quiet')
    await wrapper.find('[data-test="rv-comment"]').setValue('Great sockets.')
    await wrapper.find('[data-test="review-form"]').trigger('submit.prevent')

    const payload = wrapper.emitted('submit-review')?.[0]?.[0]
    expect(payload).toEqual({
      placeId: 9,
      rating: 4,
      comment: 'Great sockets.',
      crowdLevel: 'quiet',
    })
  })

  it('trims the comment', async () => {
    const wrapper = mount(ReviewForm, {
      props: { placeId: 9, busy: false, authorName: 'Sam' },
    })
    await wrapper.find('[data-test="rv-comment"]').setValue('   padded   ')
    await wrapper.find('[data-test="review-form"]').trigger('submit.prevent')
    expect(wrapper.emitted('submit-review')[0][0].comment).toBe('padded')
  })

  it('disables submit and shows "Posting…" while busy', () => {
    const wrapper = mount(ReviewForm, {
      props: { placeId: 1, busy: true, authorName: 'Sam' },
    })
    const submit = wrapper.find('[data-test="rv-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.text()).toContain('Posting')
  })
})