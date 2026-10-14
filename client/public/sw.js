/* LockedIN service worker - what makes the site installable as an app.
 * Pages: network first (always fresh), falling back to the cached app shell offline.
 * Built files, fonts and images: cache first (they never change once built).
 * API calls (places, reviews, login...) are never cached. */
const CACHE = 'lockedin-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // drop caches from older versions
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // app navigation: try the network, use the cached shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')))
    return
  }

  // our own static files + Google Fonts: cache first
  const isStatic = url.origin === location.origin &&
    (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/'))
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (isStatic || isFont) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone()
        caches.open(CACHE).then(cache => cache.put(req, copy))
      }
      return res
    })))
  }
  // everything else (the API, weather, NLB photos) goes straight to the network
})
