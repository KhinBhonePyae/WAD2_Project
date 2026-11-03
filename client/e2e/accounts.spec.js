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
    await page.locator('[data-test="spot-cafe"]').click()
    await page.locator('[data-test="spot-library"]').click()
    await expect(page.locator('[data-test="spot-cafe"]')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('[data-test="signup-submit"]').click()

    await expect(page.locator('[data-test="nav-user"]')).toHaveText(creds.name, { timeout: LOAD })
    await expect(page.locator('[data-test="nav-login"]')).toHaveCount(0)

    // the preference from step 2 was saved with the account
    const login = await request.post(`${API}/users/login`, { data: { email: creds.email, password: creds.password } })
    const saved = (await login.json()).user.preferences
    expect(saved.wifiRequired).toBe(true)
    expect(saved.studySpots).toEqual(['cafe', 'library'])
  })

  test('the same email cannot sign up twice', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('#name', creds.name)
    await page.fill('#email', creds.email)
    await page.fill('#password', creds.password)
    await page.fill('#confirmPassword', creds.password)
    await page.locator('[data-test="signup-next"]').click()

    await expect(page.locator('[data-test="auth-error"]')).toContainText('Email is already registered')
    await expect(page.locator('[data-test="signup-submit"]')).toHaveCount(0)
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

  test('a visitor can open the forgot password page from login', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('link', { name: 'Forgot password?' }).click()

    await expect(page).toHaveURL(/\/forgot-password$/)
    await expect(page.getByRole('heading', { name: 'Forgot password?' })).toBeVisible()
  })

  test('forgot password shows a generic success message for a valid email', async ({ page }) => {
    await page.goto('/forgot-password')

    const unknownEmail = `unknown-${stamp}@example.test`

    await page.getByLabel('Email').fill(unknownEmail)
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(
      page.getByText('If an account exists for this email, a password reset link has been sent.')
    ).toBeVisible({ timeout: LOAD })
  })

  test('reset password checks that both passwords match', async ({ page }) => {
    await page.goto('/reset-password/fake-token')

    await page.getByLabel('New password', { exact: true }).fill('new-password-123')
    await page.getByLabel('Confirm new password').fill('different-password-123')

    await page.getByRole('button', { name: 'Reset password' }).click()

    await expect(page.getByText('Passwords do not match.')).toBeVisible()
  })

  test('an invalid password reset token is refused', async ({ page }) => {
    await page.goto('/reset-password/invalid-token')

    await page.getByLabel('New password', { exact: true }).fill('new-password-123')
    await page.getByLabel('Confirm new password').fill('new-password-123')

    await page.getByRole('button', { name: 'Reset password' }).click()

    await expect(
      page.getByText('Password reset link is invalid or has expired')
    ).toBeVisible({ timeout: LOAD })
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