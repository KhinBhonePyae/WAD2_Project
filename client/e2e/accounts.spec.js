import { test, expect } from '@playwright/test'
import process from 'node:process'
import { deleteTestUser } from './auth.js'

const LOAD = 15000
const API = process.env.E2E_API_URL || 'http://localhost:8000'

/* Journey 1: register, log in, log out, all through the real forms.
 * The account is created by the test and deleted again afterwards. */

test.describe('accounts', () => {
  test.describe.configure({ mode: 'serial' })

  const stamp = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  const creds = { name: 'E2E Signup', email: `e2e-signup-${stamp}@example.test`, password: 'e2e-password-' + stamp }

  test.beforeEach(async ({ page }) => {
    // skip the notebook intro on the home page
    await page.addInitScript(() => sessionStorage.setItem('lk-notebook-opened', '1'))
  })

  test.afterAll(async ({ request }) => {
    const login = await request.post(`${API}/users/login`, { data: { email: creds.email, password: creds.password } })
    if (login.ok()) await deleteTestUser(request, { token: (await login.json()).token, password: creds.password })
  })

  test('sign-up checks the password before moving on', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('#name', creds.name)
    await page.fill('#email', creds.email)
    await page.fill('#password', 'short')
    await page.fill('#confirmPassword', 'short')
    await page.locator('[data-test="signup-next"]').click()
    await expect(page.locator('[data-test="auth-error"]')).toContainText('at least 8 characters')

    await page.fill('#password', creds.password)
    await page.fill('#confirmPassword', creds.password + 'x')
    await page.locator('[data-test="signup-next"]').click()
    await expect(page.locator('[data-test="auth-error"]')).toContainText('do not match')
  })

  test('a visitor can sign up with study preferences and is logged in', async ({ page, request }) => {
    await page.goto('/signup')
    await page.fill('#name', creds.name)
    await page.fill('#email', creds.email)
    await page.fill('#password', creds.password)
    await page.fill('#confirmPassword', creds.password)
    await page.locator('[data-test="signup-next"]').click()

    // step 2: study preferences
    await page.locator('[data-test="pref-wifi"]').check()
    await page.locator('[data-test="signup-submit"]').click()

    await expect(page).toHaveURL(/\/places$/, { timeout: LOAD })
    await expect(page.locator('[data-test="nav-user"]')).toHaveText(creds.name)
    await expect(page.locator('[data-test="nav-login"]')).toHaveCount(0)

    // the preference from step 2 was saved with the account
    const login = await request.post(`${API}/users/login`, { data: { email: creds.email, password: creds.password } })
    expect((await login.json()).user.preferences.wifiRequired).toBe(true)
  })

  test('the same email cannot sign up twice', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('#name', creds.name)
    await page.fill('#email', creds.email)
    await page.fill('#password', creds.password)
    await page.fill('#confirmPassword', creds.password)
    await page.locator('[data-test="signup-next"]').click()
    await page.locator('[data-test="signup-submit"]').click()
    await expect(page.locator('[data-test="auth-error"]')).toBeVisible({ timeout: LOAD })
    await expect(page).toHaveURL(/\/signup$/)
  })

  test('a wrong password is refused with a message', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', creds.email)
    await page.fill('#password', 'not-the-password')
    await page.locator('[data-test="login-submit"]').click()
    await expect(page.locator('[data-test="auth-error"]')).toBeVisible({ timeout: LOAD })
    await expect(page.locator('[data-test="nav-user"]')).toHaveCount(0)
  })

  test('a user can log in and log out again', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', creds.email)
    await page.fill('#password', creds.password)
    await page.locator('[data-test="login-submit"]').click()

    await expect(page.locator('[data-test="nav-user"]')).toHaveText(creds.name, { timeout: LOAD })
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy()

    // log out from the profile page
    await page.locator('[data-test="nav-user"]').click()
    await page.locator('[data-test="logout"]').click()

    await expect(page.locator('[data-test="nav-login"]')).toBeVisible({ timeout: LOAD })
    await expect(page.locator('[data-test="nav-user"]')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  })
})
