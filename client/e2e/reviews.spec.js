import { test, expect } from '@playwright/test'

/* Core user journeys for StudySpot SG.
 * Selectors use data-test attributes so restyling never breaks a test.
 * Requires the API on http://localhost:8000 (cd ../server && npm run dev). */

test('home page lists study spaces with suitability scores', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('[data-test="place-card"]')
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeGreaterThan(0)
  await expect(cards.first().locator('[data-test="score"]')).toBeVisible()
})

test('catalogue filters narrow the result set', async ({ page }) => {
  await page.goto('/places')
  await expect(page.locator('[data-test="place-card"]').first()).toBeVisible()
  const before = await page.locator('[data-test="place-card"]').count()

  await page.locator('[data-test="chip-outdoor"]').click()
  await expect
    .poll(async () => page.locator('[data-test="place-card"]').count())
    .toBeLessThan(before)

  await page.locator('[data-test="clear-filters"]').click()
  await expect
    .poll(async () => page.locator('[data-test="place-card"]').count())
    .toBe(before)
})

test('a review can be posted, edited and deleted', async ({ page }) => {
  await page.goto('/places/1')
  await expect(page.locator('[data-test="place-name"]')).toBeVisible()

  const items = page.locator('[data-test="review-item"]')
  const before = await items.count()

  // create
  const stamp = 'E2E ' + Date.now()
  await page.locator('[data-test="rv-name"]').fill(stamp)
  await page.locator('[data-test="rv-rating"]').selectOption('4')
  await page.locator('[data-test="rv-crowd"]').selectOption('quiet')
  await page.locator('[data-test="rv-comment"]').fill('Posted by an automated test.')
  await page.locator('[data-test="rv-submit"]').click()

  await expect.poll(async () => items.count()).toBe(before + 1)
  const mine = page.locator('[data-test="review-item"]', { hasText: stamp })
  await expect(mine).toHaveCount(1)

  // update
  await mine.locator('[data-test="edit-btn"]').click()
  await mine.locator('[data-test="edit-comment"]').fill('Edited by the test.')
  await mine.locator('[data-test="edit-save"]').click()
  await expect(page.locator('[data-test="review-item"]', { hasText: 'Edited by the test.' })).toHaveCount(1)

  // delete
  await page.locator('[data-test="review-item"]', { hasText: stamp })
      .locator('[data-test="delete-btn"]').click()
  await expect.poll(async () => items.count()).toBe(before)
})

test('the review form rejects an empty name', async ({ page }) => {
  await page.goto('/places/1')
  await page.locator('[data-test="rv-submit"]').click()
  await expect(page.locator('[data-test="rv-error"]')).toBeVisible()
})
