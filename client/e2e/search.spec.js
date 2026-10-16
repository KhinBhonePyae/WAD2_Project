import { test, expect } from '@playwright/test'

// pages wait on the API (MongoDB Atlas), which can be slower than Playwright's 5s default
const LOAD = 15000

test.describe('Search and filters', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/search') })

  // the score badge was taken off the cards; each result now lists why it scored as it did
  test('shows results with their suitability reasons', async ({ page }) => {
    await expect(page.locator('[data-test="place-card"]').first()).toBeVisible({ timeout: LOAD })
    await expect(page.locator('[data-test="score-reasons"]').first()).toBeVisible()
  })

  test('searching with no match shows the empty state', async ({ page }) => {
    await page.fill('[data-test="search-input"]', 'zzzz-no-such-place')
    await page.click('[data-test="search-button"]')
    await expect(page.locator('[data-test="no-results"]')).toBeVisible()
  })

  test('a facility chip can be applied and reset', async ({ page }) => {
    const chip = page.locator('[data-test^="chip-"]').first()
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await page.click('[data-test="apply-filters"]')
    await expect(page.locator('[data-test="result-count"]')).toBeVisible()
    await page.click('[data-test="reset-filters"]')
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  test('opens a place detail page from a result', async ({ page }) => {
    await page.locator('[data-test="place-link"]').first().click()
    await expect(page).toHaveURL(/\/places\/\d+/)
  })
})