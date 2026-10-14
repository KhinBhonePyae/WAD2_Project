// Single place for the API base URL, matching the IS216 wk5/wk6 pattern
// of a localhost base with axios. When the app is deployed (and installed on
// phones), set VITE_API_BASE_URL to the live server's address at build time.
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
