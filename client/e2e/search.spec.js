import { test, expect } from '@playwright/test'

// pages wait on the API (MongoDB Atlas), which can be slower than Playwright's 5s default
const LOAD = 15000

test.describe('Search and filters', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/search') })

  test('shows 12 places per page and pages through the rest', async ({ page }) => {
    const cards = page.locator('[data-test="place-card"]')
    await expect(cards.first()).toBeVisible({ timeout: LOAD })
    await expect(cards).toHaveCount(12)
    const firstName = await cards.first().locator('[data-test="place-link"]').innerText()

    await page.locator('[data-test="page-next"]').click()
    await expect(cards.first().locator('[data-test="place-link"]')).not.toHaveText(firstName)
    await expect(page.locator('[data-test="page-prev"]')).toBeEnabled()
  })

  test('searching with no match shows the empty state', async ({ page }) => {
    await expect(page.locator('[data-test="place-card"]').first()).toBeVisible({ timeout: LOAD })
    await page.fill('[data-test="hero-search"]', 'zzzz-no-such-place')
    await page.click('[data-test="hero-search-btn"]')
    await expect(page.locator('[data-test="no-results"]')).toBeVisible({ timeout: LOAD })
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