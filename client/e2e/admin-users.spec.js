import process from 'node:process'
import { test, expect } from '@playwright/test'
import { createTestUser, loginAs, deleteTestUser } from './auth.js'

const API = process.env.E2E_API_URL || 'http://localhost:8000'
const LOAD = 15000

test.describe('Admin User Management E2E', () => {
  test.describe.configure({ mode:'serial' })

  let testUser
  let admin

  test.beforeAll(async ({ request }) => {
    testUser = await createTestUser(request)

    const adminEmail = process.env.E2E_ADMIN_EMAIL
    const adminPassword = process.env.E2E_ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      throw new Error(
        'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD before running this test.'
      )
    }

    const response = await request.post(`${API}/users/login`, {
      data:{
        email:adminEmail,
        password:adminPassword
      }
    })

    if (!response.ok()) {
      throw new Error(
        `admin login failed: ${response.status()} ${await response.text()}`
      )
    }

    admin = await response.json()

    if (admin.user.role !== 'admin') {
      throw new Error(
        'E2E_ADMIN_EMAIL must belong to an admin account.'
      )
    }
  })

  test.afterAll(async ({ request }) => {
    if (testUser) {
      await deleteTestUser(request, testUser)
    }
  })

  test('normal user cannot access admin user management', async ({ page }) => {
    await loginAs(page, testUser)

    await page.goto('/admin/users')

    await expect(page).toHaveURL(/\/places$/)
  })

  test('admin account is protected from changing itself', async ({ page }) => {
    await loginAs(page, admin)

    await page.goto('/admin/users')

    await expect(
      page.getByRole('heading', { name:'Users' })
    ).toBeVisible({ timeout:LOAD })

    await page.locator(
      'input[placeholder="Search by name or email..."]'
    ).fill(admin.user.email)

    const row = page.locator('.user-row', {
      hasText:admin.user.email
    })

    await expect(row).toHaveCount(1)

    await expect(
      row.locator('.protected-text')
    ).toHaveText('Protected')

    await expect(
      row.locator('.role-select')
    ).toBeDisabled()
  })

  test('admin can promote and demote another user', async ({ page }) => {
    await loginAs(page, admin)

    await page.goto('/admin/users')

    await page.locator(
      'input[placeholder="Search by name or email..."]'
    ).fill(testUser.user.email)

    const row = page.locator('.user-row', {
      hasText:testUser.user.email
    })

    await expect(row).toHaveCount(1)

    const roleSelect = row.locator('.role-select')

    await expect(roleSelect).toHaveValue('user')

    await roleSelect.selectOption('admin')

    await expect(
      page.locator('.alert-success')
    ).toContainText('role was updated to admin')

    await expect(roleSelect).toHaveValue('admin')

    await roleSelect.selectOption('user')

    await expect(
      page.locator('.alert-success')
    ).toContainText('role was updated to user')

    await expect(roleSelect).toHaveValue('user')
  })

  test('admin can delete another user with confirmation modal', async ({ page }) => {
    await loginAs(page, admin)

    await page.goto('/admin/users')

    await page.locator(
      'input[placeholder="Search by name or email..."]'
    ).fill(testUser.user.email)

    const row = page.locator('.user-row', {
      hasText:testUser.user.email
    })

    await expect(row).toHaveCount(1)

    await row.locator('.delete-btn').click()

    await expect(
      page.locator('.confirm-overlay')
    ).toBeVisible()

    await expect(
      page.getByText('Delete this account?')
    ).toBeVisible()

    await page.locator('.confirm-delete').click()

    await expect(
      page.locator('.alert-success')
    ).toBeVisible()

    await expect(
      page.locator('.user-row', {
        hasText:testUser.user.email
      })
    ).toHaveCount(0)

    // Account is already deleted, so afterAll should not delete it again.
    testUser = null
  })
})