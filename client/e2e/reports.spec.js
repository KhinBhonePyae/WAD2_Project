import process from 'node:process'
import { test, expect } from '@playwright/test'
import { createTestUser, loginAs, deleteTestUser } from './auth.js'

const API = process.env.E2E_API_URL || 'http://localhost:8000'
const LOAD = 15000

test.describe('Report Issue E2E', () => {
  test.describe.configure({ mode:'serial' })

  let account
  let admin
  const stamp = `E2E report ${Date.now()}`

  test.beforeAll(async ({ request }) => {
    account = await createTestUser(request)

    const profile = await request.put(`${API}/users/profile`, {
      headers:{ Authorization:`Bearer ${account.token}` },
      data:{
        name:account.user.name,
        email:account.user.email,
        preferences:{
          wifiRequired:true,
          socketsRequired:false,
          quietPreferred:false,
          indoorPreferred:false
        }
      }
    })

    if (!profile.ok()) throw new Error(`profile update failed: ${profile.status()} ${await profile.text()}`)

    const profileData = await profile.json()
    account.user = profileData.user

    const adminEmail = process.env.E2E_ADMIN_EMAIL
    const adminPassword = process.env.E2E_ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD before running this test.')
    }

    const login = await request.post(`${API}/users/login`, {
      data:{ email:adminEmail, password:adminPassword }
    })

    if (!login.ok()) throw new Error(`admin login failed: ${login.status()} ${await login.text()}`)

    admin = await login.json()

    if (admin.user.role !== 'admin') {
      throw new Error('E2E_ADMIN_EMAIL must belong to an admin account.')
    }
  })

  test.afterAll(async ({ request }) => {
    if (admin?.token) {
      const response = await request.get(`${API}/reports/admin`, {
        headers:{ Authorization:`Bearer ${admin.token}` }
      })

      if (response.ok()) {
        const data = await response.json()

        for (const report of data.reports.filter(r => r.message === stamp)) {
          await request.delete(`${API}/reports/admin/${report._id}`, {
            headers:{ Authorization:`Bearer ${admin.token}` }
          })
        }
      }
    }

    if (account) await deleteTestUser(request, account)
  })

  test('logged-in user can submit incorrect place information', async ({ page }) => {
    await loginAs(page, account)

    await page.goto('/places/1')

    await expect(page.locator('[data-test="place-name"]')).toBeVisible({ timeout:LOAD })

    await page.locator('.report-trigger').click()

    await expect(page.locator('.report-overlay')).toBeVisible()

    await page.locator('#reportCategory').selectOption('hours')
    await page.locator('#reportMessage').fill(stamp)

    await page.getByRole('button', { name:'Submit report' }).click()

    await expect(page.getByText('Report sent', { exact:true })).toBeVisible()
    await expect(page.getByText('Thanks! Your report has been sent to the admin team.')).toBeVisible()
  })

  test('normal user cannot access Admin Reports', async ({ page }) => {
    await loginAs(page, account)

    await page.goto('/admin/reports')

    await expect(page).toHaveURL(/\/places$/)
  })

  test('admin can resolve, reopen and delete the submitted report', async ({ page }) => {
    await loginAs(page, admin)

    await page.goto('/admin/reports')

    await expect(page.getByRole('heading', { name:'Reported Information' })).toBeVisible({ timeout:LOAD })

    await page.locator('.reports-search').fill(stamp)

    let card = page.locator('.report-card', { hasText:stamp })

    await expect(card).toHaveCount(1)
    await expect(card.locator('.report-status')).toHaveText('pending')

    await card.getByRole('button', { name:'Mark resolved' }).click()

    await expect(page.getByText('Report marked as resolved.')).toBeVisible()

    await page.locator('.reports-filter').selectOption('resolved')

    card = page.locator('.report-card', { hasText:stamp })

    await expect(card).toHaveCount(1)
    await expect(card.locator('.report-status')).toHaveText('resolved')

    await card.getByRole('button', { name:'Reopen' }).click()

    await expect(page.getByText('Report reopened.')).toBeVisible()

    await page.locator('.reports-filter').selectOption('pending')

    card = page.locator('.report-card', { hasText:stamp })

    await expect(card).toHaveCount(1)

    await card.locator('.report-delete').click()

    await expect(page.locator('.confirm-overlay')).toBeVisible()
    await expect(page.getByText('Delete this report?')).toBeVisible()

    await page.locator('.confirm-delete').click()

    await expect(page.getByText('Report deleted.')).toBeVisible()
    await expect(page.locator('.report-card', { hasText:stamp })).toHaveCount(0)
  })
})