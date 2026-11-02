import { test, expect } from '@playwright/test'
import { createTestUser, loginAs, deleteTestUser, deleteReviewsByUser } from './auth.js'

// pages wait on the API (MongoDB Atlas), which can be slower than Playwright's 5s default
const LOAD = 15000

/* Core user journeys for LockedIN.
 * Selectors use data-test attributes so restyling never breaks a test.
 * Requires the API on http://localhost:8000 (cd ../server && pnpm dev). */

test('home page lists study spaces', async ({ page }) => {
  // skip the notebook intro so the cards are reachable straight away
  await page.addInitScript(() => sessionStorage.setItem('lk-notebook-opened', '1'))
  await page.goto('/')
  const cards = page.locator('[data-test="place-card"]')
  await expect(cards.first()).toBeAttached({ timeout: LOAD })
  expect(await cards.count()).toBeGreaterThan(0)
})

test('browse filters narrow the result set', async ({ page }) => {
  // Browse lives at /search now; the result count covers every page, not just the 12 shown
  const resultCount = async () => parseInt(await page.locator('[data-test="result-count"]').innerText(), 10)
  await page.goto('/search')
  await expect(page.locator('[data-test="place-card"]').first()).toBeVisible({ timeout: LOAD })
  const before = await resultCount()

  await page.locator('[data-test="free-entry"]').check()
  await page.locator('[data-test="apply-filters"]').click()
  await expect.poll(resultCount).toBeLessThan(before)

  await page.locator('[data-test="reset-filters"]').click()
  await expect.poll(resultCount).toBe(before)
})

test.describe('reviews', () => {
  test('logged-out visitors can read reviews but get a log-in prompt instead of the form', async ({ page }) => {
    await page.goto('/places/1')
    await expect(page.locator('[data-test="place-name"]')).toBeVisible({ timeout: LOAD })
    await expect(page.getByRole('link', { name:'Log in to review' })).toBeVisible()
    await expect(page.locator('[data-test="review-form"]')).toHaveCount(0)
  })

  test('the API refuses to post a review without a login', async ({ request }) => {
    const res = await request.post('http://localhost:8000/reviews', {
      data: { placeId: 1, rating: 5, comment: 'should be refused' },
    })
    expect(res.status()).toBe(401)
  })

  test.describe('logged in', () => {
    // one throwaway account for these tests, deleted again afterwards
    test.describe.configure({ mode: 'serial' })
    let account

    test.beforeAll(async ({ request }) => { account = await createTestUser(request) })
    test.afterAll(async ({ request }) => {
      if (!account) return
      await deleteReviewsByUser(request, account, 1)
      await deleteTestUser(request, account)
    })
    test.beforeEach(async ({ page }) => { await loginAs(page, account) })

    test("a user gets no edit or delete buttons on other people's reviews", async ({ page }) => {
      await page.goto('/places/1')
      await expect(page.locator('[data-test="review-item"]').first()).toBeVisible({ timeout: LOAD })
      await expect(page.locator('[data-test="edit-btn"]')).toHaveCount(0)
      await expect(page.locator('[data-test="delete-btn"]')).toHaveCount(0)
    })

    test('a user can post, edit and delete their own review', async ({ page }) => {
      await page.goto('/places/1')
      // the form lives in a popup opened from the reviews section
      await page.locator('[data-test="review-open"]').click({ timeout: LOAD })
      await expect(page.locator('[data-test="review-form"]')).toBeVisible()

      // create (the author is the logged-in user, so there is no name field)
      const stamp = 'E2E ' + Date.now()
      await page.locator('[data-test="star-4"]').click()
      await expect(page.locator('[data-test="star-4"]')).toHaveAttribute('aria-checked', 'true')
      await page.locator('[data-test="rv-crowd"]').selectOption('quiet')
      await page.locator('[data-test="rv-comment"]').fill(stamp)
      await page.locator('[data-test="rv-submit"]').click()

      // the popup closes and the new review is first on page 1 (6 reviews per page)
      await expect(page.locator('[data-test="review-form"]')).toHaveCount(0)
      const mine = page.locator('[data-test="review-item"]', { hasText: stamp })
      await expect(mine).toHaveCount(1)
      await expect(page.locator('[data-test="review-item"]').first()).toContainText(stamp)

      // update
      // in edit mode the comment becomes a textbox, so the review no longer matches by text;
      // it is the only review this user may edit, so target the edit fields directly
      await mine.locator('[data-test="edit-btn"]').click()
      await page.locator('[data-test="edit-comment"]').fill(stamp + ' edited')
      await page.locator('[data-test="edit-save"]').click()
      await expect(page.locator('[data-test="review-item"]', { hasText: stamp + ' edited' })).toHaveCount(1)

      // delete
      await page.locator('[data-test="review-item"]', { hasText: stamp })
        .locator('[data-test="delete-btn"]').click()
      await expect(page.locator('[data-test="review-item"]', { hasText: stamp })).toHaveCount(0)
    })
  })
})
