/* Test-account helper: posting, editing and deleting reviews needs a logged-in user.
 * Creates a throwaway account through the API, logs the browser in by writing the
 * same localStorage keys LoginView does, and deletes the account afterwards. */
import process from 'node:process'

const API = process.env.E2E_API_URL || 'http://localhost:8000'

export async function createTestUser(request) {
  const stamp = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  const creds = { name: 'E2E Tester', email: `e2e-${stamp}@example.test`, password: 'e2e-password-' + stamp }

  const reg = await request.post(`${API}/users/register`, { data: creds })
  if (!reg.ok()) throw new Error(`register failed: ${reg.status()} ${await reg.text()}`)
  const login = await request.post(`${API}/users/login`, { data: { email: creds.email, password: creds.password } })
  if (!login.ok()) throw new Error(`login failed: ${login.status()} ${await login.text()}`)

  const { token, user } = await login.json()
  return { token, user, password: creds.password }
}

export async function loginAs(page, { token, user }) {
  await page.addInitScript(([t, u]) => {
    localStorage.setItem('token', t)
    localStorage.setItem('user', u)
  }, [token, JSON.stringify(user)])
}

export async function deleteTestUser(request, { token, password }) {
  // deleting your own account asks for the password again
  await request.delete(`${API}/users/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { password },
  })
}

// safety net: if a test fails half-way, remove any review it left behind
export async function deleteReviewsByUser(request, { token, user }, placeId) {
  const res = await request.get(`${API}/reviews/place/${placeId}`)
  if (!res.ok()) return
  const list = await res.json()
  const reviews = Array.isArray(list) ? list : list.reviews || []
  for (const r of reviews.filter(r => String(r.userId) === String(user.id ?? user._id))) {
    await request.delete(`${API}/reviews/${r._id ?? r.id}`, { headers: { Authorization: `Bearer ${token}` } })
  }
}
