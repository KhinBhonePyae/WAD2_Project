export const BASE_URL = 'http://localhost:8000'

export function authConfig() {
  const token = localStorage.getItem('token')
  if (!token) return {}

  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
}