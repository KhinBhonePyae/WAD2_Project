import { test, expect } from '@playwright/test'
import { createTestUser, loginAs, deleteTestUser } from './auth.js'

const LOAD = 15000
const API = 'http://localhost:8000'

/* Crowd reporting: the "How busy is it?" card and its one-tap check-in.
 * Check-ins only open while a place is open, so the test picks one that is.
 * Deleting the test account also deletes its check-ins. */

test('the API refuses a crowd check-in without a login', async ({ request }) => {
  const res = await request.post(`${API}/crowd/1`, { data: { level: 'quiet' } })
  expect(res.status()).toBe(401)
})

test.describe('logged in', () => {
  // one account for both tests; the second undoes the report the first left behind
  test.describe.configure({ mode: 'serial' })
  let account

  test.beforeAll(async ({ request }) => { account = await createTestUser(request) })
  test.afterAll(async ({ request }) => { if (account) await deleteTestUser(request, account) })

  test('a user can report how busy a place is, and change it', async ({ page, request }) => {
    const places = await (await request.get(`${API}/places`)).json()
    // not place 1: the reviews tests post a review there at the same time, which also counts as a crowd report
    const open = places.find(p => p.openNow && p.id !== 1)
    test.skip(!open, 'no study space is open right now')

    await loginAs(page, account)
    await page.goto(`/places/${open.id}`)
    const card = page.locator('[data-test="crowd-card"]')
    await expect(card.locator('[data-test="crowd-checkin"]')).toBeVisible({ timeout: LOAD })

    await card.locator('[data-test="checkin-quiet"]').click()
    await expect(card.locator('[data-test="crowd-latest"]')).toContainText('Quiet right now')
    await expect(card.locator('[data-test="checkin-quiet"]')).toHaveAttribute('aria-pressed', 'true')

    // a second tap within the hour changes the report instead of adding another
    const { total } = await (await request.get(`${API}/crowd/place/${open.id}`)).json()
    await card.locator('[data-test="checkin-packed"]').click()
    await expect(card.locator('[data-test="crowd-latest"]')).toContainText('Packed right now')
    const after = await (await request.get(`${API}/crowd/place/${open.id}`)).json()
    expect(after.total).toBe(total)

    // the choice is remembered after a reload
    await page.reload()
    await expect(card.locator('[data-test="checkin-packed"]')).toHaveAttribute('aria-pressed', 'true', { timeout: LOAD })
  })

  test('a user can undo an accidental report', async ({ page, request }) => {
    const places = await (await request.get(`${API}/places`)).json()
    // not place 1: the reviews tests post a review there at the same time, which also counts as a crowd report
    const open = places.find(p => p.openNow && p.id !== 1)
    test.skip(!open, 'no study space is open right now')

    await loginAs(page, account)
    await page.goto(`/places/${open.id}`)
    const card = page.locator('[data-test="crowd-card"]')
    await expect(card.locator('[data-test="crowd-checkin"]')).toBeVisible({ timeout: LOAD })
    const before = (await (await request.get(`${API}/crowd/place/${open.id}`)).json()).total

    // the previous test left a report; undo it with the link
    await card.locator('[data-test="checkin-undo"]').click()
    await expect(card.locator('[data-test="checkin-thanks"]')).toHaveCount(0)
    expect((await (await request.get(`${API}/crowd/place/${open.id}`)).json()).total).toBe(before - 1)

    // tapping the chosen level again also takes it back
    await card.locator('[data-test="checkin-moderate"]').click()
    await expect(card.locator('[data-test="checkin-moderate"]')).toHaveAttribute('aria-pressed', 'true')
    await card.locator('[data-test="checkin-moderate"]').click()
    await expect(card.locator('[data-test="checkin-moderate"]')).toHaveAttribute('aria-pressed', 'false')
    expect((await (await request.get(`${API}/crowd/place/${open.id}`)).json()).total).toBe(before - 1)
  })
})
