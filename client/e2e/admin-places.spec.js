import process from 'node:process'
import { test, expect } from '@playwright/test'
import { createTestUser, loginAs, deleteTestUser } from './auth.js'

const API = process.env.E2E_API_URL || 'http://localhost:8000'
const LOAD = 15000

test.describe('Admin Study Space Management E2E', () => {
  test.describe.configure({ mode:'serial' })

  let normalUser
  let admin
  let placeId = null

  const stamp = Date.now()
  const placeName = `E2E Study Space ${stamp}`
  const updatedName = `E2E Updated Space ${stamp}`

  test.beforeAll(async ({ request }) => {
    normalUser = await createTestUser(request)

    const adminEmail = process.env.E2E_ADMIN_EMAIL
    const adminPassword = process.env.E2E_ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD before running this test.')
    }

    const login = await request.post(`${API}/users/login`, {
      data:{ email:adminEmail, password:adminPassword }
    })

    if (!login.ok()) {
      throw new Error(`admin login failed: ${login.status()} ${await login.text()}`)
    }

    admin = await login.json()

    if (admin.user.role !== 'admin') {
      throw new Error('E2E_ADMIN_EMAIL must belong to an admin account.')
    }
  })

  test.afterAll(async ({ request }) => {
    // Safety cleanup in case the browser test fails before deleting the place
    if (admin?.token) {
      const response = await request.get(`${API}/places`)

      if (response.ok()) {
        const places = await response.json()

        for (const place of places.filter(p =>
          p.name === placeName || p.name === updatedName
        )) {
          await request.delete(`${API}/places/${place.id}`, {
            headers:{ Authorization:`Bearer ${admin.token}` }
          })
        }
      }
    }

    if (normalUser) {
      await deleteTestUser(request, normalUser)
    }
  })

  test('normal user cannot access admin study space management', async ({ page }) => {
    await loginAs(page, normalUser)

    await page.goto('/admin/places')

    await expect(page).toHaveURL(/\/places$/)
  })

  test('admin can create a new study space', async ({ page }) => {
    await loginAs(page, admin)

    await page.goto('/admin/places/new')

    await expect(
      page.getByRole('heading', { name:'Add Study Space' })
    ).toBeVisible({ timeout:LOAD })

    await page.locator('input[placeholder="e.g. Li Ka Shing Library"]').fill(placeName)
    await page.locator('input[placeholder="e.g. Bras Basah"]').fill('SMU')
    await page.locator('input[placeholder="e.g. 70 Stamford Rd, Singapore 178901"]').fill('80 Stamford Road, Singapore')

    await page.locator('input[placeholder="e.g. 1.2963"]').fill('1.2966')
    await page.locator('input[placeholder="e.g. 103.8502"]').fill('103.8500')

    await page.locator('input[type="time"]').nth(0).fill('08:00')
    await page.locator('input[type="time"]').nth(1).fill('22:00')

    await page.locator('[data-test="capacity-input"]').fill('50')
    await page.locator('[data-test="entry-select"]').selectOption('free')

    await page.locator('input[placeholder="https://example.com/photo1.jpg"]')
      .fill('https://picsum.photos/800/500')

    await page.locator('textarea[placeholder="Describe the study space..."]')
      .fill('Temporary study space created by the Playwright E2E test.')

    await page.getByRole('button', { name:'Add Study Space' }).click()

    await expect(page).toHaveURL(/\/places\/\d+$/, { timeout:LOAD })

    const match = page.url().match(/\/places\/(\d+)$/)
    placeId = match?.[1]

    expect(placeId).toBeTruthy()

    await expect(
      page.locator('[data-test="place-name"]')
    ).toContainText(placeName)
  })

  test('admin can edit the study space', async ({ page }) => {
    expect(placeId).toBeTruthy()

    await loginAs(page, admin)

    await page.goto(`/admin/places/${placeId}/edit`)

    await expect(
      page.getByRole('heading', { name:'Edit Study Space' })
    ).toBeVisible({ timeout:LOAD })

    const nameInput = page.locator(
      'input[placeholder="e.g. Li Ka Shing Library"]'
    )

    await expect(nameInput).toHaveValue(placeName)

    await nameInput.fill(updatedName)

    await page.getByRole('button', { name:'Save Changes' }).click()

    await expect(page).toHaveURL(
      new RegExp(`/places/${placeId}$`),
      { timeout:LOAD }
    )

    await expect(
      page.locator('[data-test="place-name"]')
    ).toContainText(updatedName)
  })

  test('admin can delete the study space', async ({ page }) => {
    await loginAs(page, admin)

    await page.goto('/admin/places')

    await expect(
      page.getByRole('heading', { name:'Manage Study Spaces' })
    ).toBeVisible({ timeout:LOAD })

    await page.locator(
      'input[placeholder="Search by name, area or address..."]'
    ).fill(updatedName)

    const row = page.locator('.admin-place-row', {
      hasText:updatedName
    })

    await expect(row).toHaveCount(1)

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain(updatedName)
      await dialog.accept()
    })

    await row.getByRole('button', { name:'Delete' }).click()

    await expect(
      page.locator('.admin-place-row', { hasText:updatedName })
    ).toHaveCount(0)

    placeId = null
  })
})