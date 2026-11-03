import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewList from '../ReviewList.vue'

const makeReview = (id, extra = {}) => ({
  _id: id,
  author: `Author ${id}`,
  rating: 4,
  comment: `Review ${id}`,
  crowdLevel: 'moderate',
  createdAt: new Date('2026-11-01T10:00:00Z').toISOString(),
  userId: 'other',
  ...extra,
})

const eightReviews = Array.from({ length: 8 }, (_, i) => makeReview(`r${i + 1}`))

describe('ReviewList: pagination', () => {
  it('shows 6 reviews per page', () => {
    const wrapper = mount(ReviewList, {
      props: { reviews: eightReviews, currentUserId: 'u1' },
    })
    expect(wrapper.findAll('[data-test="review-item"]')).toHaveLength(6)
    expect(wrapper.find('[data-test="review-page-2"]').exists()).toBe(true)
  })

  it('pages forward and back', async () => {
    const wrapper = mount(ReviewList, {
      props: { reviews: eightReviews, currentUserId: 'u1' },
    })
    await wrapper.find('[data-test="review-next"]').trigger('click')
    expect(wrapper.findAll('[data-test="review-item"]')).toHaveLength(2)

    await wrapper.find('[data-test="review-prev"]').trigger('click')
    expect(wrapper.findAll('[data-test="review-item"]')).toHaveLength(6)
  })

  it('jumps back to page 1 when a new review is added', async () => {
    const wrapper = mount(ReviewList, {
      props: { reviews: eightReviews, currentUserId: 'u1' },
    })
    await wrapper.find('[data-test="review-page-2"]').trigger('click')
    await wrapper.setProps({ reviews: [makeReview('new'), ...eightReviews] })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-test="review-item"]')).toHaveLength(6)
  })

  it('clamps the page when reviews are deleted', async () => {
    const twoPages = Array.from({ length: 7 }, (_, i) => makeReview(`r${i + 1}`))
    const wrapper = mount(ReviewList, {
      props: { reviews: twoPages, currentUserId: 'u1' },
    })
    await wrapper.find('[data-test="review-page-2"]').trigger('click')
    // Delete one review: 6 left → only one page
    await wrapper.setProps({ reviews: twoPages.slice(0, 6) })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-test="review-item"]')).toHaveLength(6)
    expect(wrapper.find('[data-test="review-pager"]').exists()).toBe(false)
  })

  it('hides the pager for a single page of reviews', () => {
    const wrapper = mount(ReviewList, {
      props: { reviews: [makeReview('a')], currentUserId: 'u1' },
    })
    expect(wrapper.find('[data-test="review-pager"]').exists()).toBe(false)
  })
})

describe('ReviewList: editing', () => {
  it('shows edit / delete only on the current user\'s reviews', () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews: [makeReview('mine', { userId: 'u1' }), makeReview('theirs', { userId: 'u2' })],
        currentUserId: 'u1',
      },
    })
    const cards = wrapper.findAll('[data-test="review-item"]')
    expect(cards[0].find('[data-test="edit-btn"]').exists()).toBe(true)
    expect(cards[0].find('[data-test="delete-btn"]').exists()).toBe(true)
    expect(cards[1].find('[data-test="edit-btn"]').exists()).toBe(false)
  })

  it('emits edit-review with the draft values', async () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews: [makeReview('mine', { userId: 'u1', rating: 3, crowdLevel: 'packed' })],
        currentUserId: 'u1',
      },
    })
    await wrapper.find('[data-test="edit-btn"]').trigger('click')
    await wrapper.find('[data-test="edit-comment"]').setValue('Updated text')
    await wrapper.find('[data-test="edit-crowd"]').setValue('quiet')
    await wrapper.find('[data-test="edit-save"]').trigger('click')

    expect(wrapper.emitted('edit-review')?.[0]?.[0]).toEqual({
      id: 'mine',
      rating: 3,
      comment: 'Updated text',
      crowdLevel: 'quiet',
    })
  })

  it('cancels an edit without emitting', async () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews: [makeReview('mine', { userId: 'u1' })],
        currentUserId: 'u1',
      },
    })
    await wrapper.find('[data-test="edit-btn"]').trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Cancel').trigger('click')
    expect(wrapper.find('[data-test="edit-comment"]').exists()).toBe(false)
    expect(wrapper.emitted('edit-review')).toBeUndefined()
  })
})