import { test, expect } from '@playwright/test'
import { createTestUser, loginAs, deleteTestUser } from './auth.js'

const LOAD = 15000

/* Journey 6: save a place from Browse, see it on the Saved page, remove it.
 * Deleting the test account afterwards also deletes its saved places. */

test('a logged-out visitor who taps the heart is sent to log in', async ({ page }) => {
  await page.goto('/places')
  const card = page.locator('[data-test="place-card"]').first()
  await expect(card).toBeVisible({ timeout: LOAD })
  await card.locator('[data-test="fav"]').click()
  await expect(page).toHaveURL(/\/login$/)
})

test.describe('logged in', () => {
  let account

  test.beforeAll(async ({ request }) => { account = await createTestUser(request) })
  test.afterAll(async ({ request }) => { if (account) await deleteTestUser(request, account) })
  test.beforeEach(async ({ page }) => { await loginAs(page, account) })

  test('a user can save a place, find it on the Saved page, and remove it', async ({ page }) => {
    // a new account starts with nothing saved
    await page.goto('/saved')
    await expect(page.getByText('No saved places yet')).toBeVisible({ timeout: LOAD })

    // save the first place on Browse
    await page.goto('/places')
    const card = page.locator('[data-test="place-card"]').first()
    await expect(card).toBeVisible({ timeout: LOAD })
    const name = (await card.locator('[data-test="place-link"]').innerText()).trim()
    await card.locator('[data-test="fav"]').click()
    await expect(card.locator('[data-test="fav"]')).toHaveAttribute('aria-pressed', 'true')

    // it stays saved after a reload
    await page.reload()
    const sameCard = page.locator('[data-test="place-card"]', { hasText: name }).first()
    await expect(sameCard.locator('[data-test="fav"]')).toHaveAttribute('aria-pressed', 'true', { timeout: LOAD })

    // it is on the Saved page (opened by URL: the nav slides away once the page is scrolled)
    await page.goto('/saved')
    const saved = page.locator('[data-test="place-card"]')
    await expect(saved).toHaveCount(1, { timeout: LOAD })
    await expect(saved.first()).toContainText(name)

    // remove it from the Saved page
    await saved.first().locator('[data-test="fav"]').click()
    await expect(page.locator('[data-test="place-card"]')).toHaveCount(0)
    await expect(page.getByText('No saved places yet')).toBeVisible()

    // and it is gone for good
    await page.reload()
    await expect(page.getByText('No saved places yet')).toBeVisible({ timeout: LOAD })
  })
})
