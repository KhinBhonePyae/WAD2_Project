<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import axios from 'axios'
import CustomCursor from './components/CustomCursor.vue'
import AssistantBubble from './components/AssistantBubble.vue'
import WorldChat from './components/WorldChat.vue'
import { startSmoothScroll, scrollToTop, ScrollTrigger, reducedMotion } from './utils/motion.js'
import { BASE_URL, authConfig } from './utils/api.js'
import logoUrl from './assets/logo.svg'

const router = useRouter()

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user')) }
  catch { return null }
}

const user = ref(getStoredUser())
const navHidden = ref(false)
const progress = ref(0)
let lastY = 0
let syncingUser = false

function removeNow(el, done) { done() }
function updateUser() { user.value = getStoredUser() }

async function syncCurrentUser() {
  const token = localStorage.getItem('token')
  if (!token) { user.value = null; return }
  if (syncingUser) return

  syncingUser = true
  try {
    const { data } = await axios.get(`${BASE_URL}/users/profile`, authConfig())
    localStorage.setItem('user', JSON.stringify(data))
    user.value = data

    if (router.currentRoute.value.meta.requiresAdmin && data.role !== 'admin') {
      router.replace('/places')
    }
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      user.value = null
      if (router.currentRoute.value.meta.requiresAdmin) router.replace('/login')
    } else {
      console.error('Could not refresh current user', error)
    }
  } finally {
    syncingUser = false
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') syncCurrentUser()
}

function onScroll() {
  const y = window.scrollY
  navHidden.value = y > 140 && y > lastY
  lastY = y
  const max = document.documentElement.scrollHeight - window.innerHeight
  progress.value = max > 0 ? y / max : 0
}

const removeAfterEach = router.afterEach(() => {
  scrollToTop()
  navHidden.value = false
  nextTick(() => setTimeout(() => ScrollTrigger.refresh(), 450))
})

onMounted(() => {
  startSmoothScroll()
  window.addEventListener('user-login', updateUser)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('focus', syncCurrentUser)
  document.addEventListener('visibilitychange', onVisibilityChange)
  syncCurrentUser()
})

onUnmounted(() => {
  window.removeEventListener('user-login', updateUser)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('focus', syncCurrentUser)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  removeAfterEach()
})
</script>

<template>
  <CustomCursor />
  <WorldChat :user="user" />
  <AssistantBubble />
  <div class="x-progress" :style="{ transform: `scaleX(${progress})` }" aria-hidden="true"></div>

  <nav class="x-nav" :class="{ 'x-nav--hidden': navHidden }">
    <RouterLink to="/" class="x-nav__brand" data-cursor="home">
      <img :src="logoUrl" alt="" class="x-nav__logo">
      <span class="x-nav__name">LockedIN</span>
    </RouterLink>

    <div class="x-nav__links">
      <RouterLink to="/places" class="x-nav__link" data-test="nav-browse">Browse</RouterLink>

      <template v-if="!user">
        <RouterLink to="/signup" class="x-nav__link">Sign up</RouterLink>
        <RouterLink to="/login" class="btn btn-primary btn-sm">Log in</RouterLink>
      </template>

      <template v-else>
        <RouterLink v-if="user.role === 'admin'" to="/admin/places" class="x-nav__link" data-test="nav-manage">Manage</RouterLink>
        <RouterLink v-if="user.role === 'admin'" to="/admin/users" class="x-nav__link">Users</RouterLink>
        <RouterLink v-if="user.role === 'admin'" to="/admin/reports" class="x-nav__link">Reports</RouterLink>
        <RouterLink to="/profile" class="x-nav__link x-nav__user">{{ user.name }}</RouterLink>
      </template>

      <RouterLink to="/saved" class="x-nav__saved" aria-label="Saved places" title="Saved places" data-test="nav-saved" data-cursor="saved">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6.5 3.5h11v17l-5.5-4.6-5.5 4.6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
        </svg>
      </RouterLink>
    </div>
  </nav>

  <RouterView v-slot="{ Component, route }">
    <Transition :name="reducedMotion ? '' : 'x-route'" @leave="removeNow">
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>

  <footer class="x-footer">
    <div class="x-footer__marquee" aria-hidden="true">
      <div class="x-footer__track">
        <span v-for="n in 6" :key="n">LOCK IN <i class="x-serif">and actually study</i> ✶ </span>
      </div>
    </div>
    <div class="container d-flex flex-wrap justify-content-between gap-2 x-footer__meta">
      <span>LockedIN — IS216 G10 Team T3 · prototype</span>
      <span>Weather by Open-Meteo · Libraries by NLB</span>
    </div>
  </footer>
</template>

<style scoped>
.x-progress { position: fixed; left: 0; top: 0; right: 0; height: 4px; z-index: 1100; background: var(--x-orange); transform-origin: 0 50%; }
.x-nav { position: fixed; top: 14px; left: 50%; z-index: 1050; display: flex; align-items: center; gap: 18px; width: min(1120px, calc(100% - 24px)); padding: 8px 8px 8px 16px; background: rgba(255,253,248,.86); backdrop-filter: blur(12px); border: var(--x-line); border-radius: 999px; box-shadow: var(--x-pop); transform: translateX(-50%); transition: transform .5s var(--x-ease-out); }
.x-nav--hidden { transform: translate(-50%,-140%); }
.x-nav__brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.2rem; letter-spacing: -.03em; color: var(--x-ink); text-decoration: none; }
.x-nav__logo { width: 30px; height: 30px; transition: transform .6s var(--x-ease); }
.x-nav__brand:hover .x-nav__logo { transform: rotate(-14deg) scale(1.15); }
.x-nav__links { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.x-nav__link { position: relative; padding: 6px 12px; border-radius: 999px; font-weight: 600; color: var(--x-ink); text-decoration: none; transition: background-color .2s; }
.x-nav__link:hover { background: var(--x-lime); }
.x-nav__link.router-link-active { background: var(--x-ink); color: var(--x-paper); }
.x-nav__link, .x-nav .btn { white-space: nowrap; }
.x-nav__saved { display: grid; place-items: center; width: 38px; height: 38px; margin-left: 4px; flex-shrink: 0; border-radius: 50%; background: var(--x-ink); color: var(--x-paper); transition: transform .2s var(--x-ease), background-color .2s; }
.x-nav__saved:hover { transform: scale(1.08); background: var(--x-orange); color: var(--x-ink); }
.x-nav__saved.router-link-active { background: var(--x-orange); color: var(--x-ink); }
.x-nav__saved.router-link-active path { fill: currentColor; }
.x-nav__user { max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x-footer { margin-top: 4rem; padding-bottom: 1.5rem; overflow: hidden; }
.x-footer__marquee { padding: .9rem 0 .7rem; border-bottom: 1px solid rgba(243,238,227,.2); }
.x-footer__track { display: inline-flex; white-space: nowrap; font-weight: 800; font-size: clamp(1.75rem,5.3vw,4rem); letter-spacing: -.04em; color: var(--x-paper); animation: x-marquee 26s linear infinite; }
.x-footer__track .x-serif { color: var(--x-lime); font-weight: 400; }
.x-footer__meta { padding-top: 1rem; font-size: .85rem; color: rgba(243,238,227,.75); }
@keyframes x-marquee { to { transform: translateX(-50%); } }
@media (max-width: 575.98px) { .x-nav { gap: 6px; padding: 6px 6px 6px 12px; } .x-nav__brand { font-size: 1rem; } .x-nav__logo { width: 24px; height: 24px; } .x-nav__link { padding: 5px 7px; font-size: .85rem; } .x-nav__user { max-width: 4.5rem; } }
@media (max-width: 420px) { .x-nav__name { display: none; } .x-nav .btn-sm { --bs-btn-padding-x: .7rem; } }
@media (prefers-reduced-motion: reduce) { .x-footer__track { animation: none; } }
</style>
