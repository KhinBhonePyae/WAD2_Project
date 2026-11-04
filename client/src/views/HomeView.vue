<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { fetchWeather } from '../utils/weather.js'
import { fetchSavedIds, toggleSavedId, isLoggedIn } from '../utils/saved.js'
import { gsap, ScrollTrigger, reducedMotion, finePointer } from '../utils/motion.js'
import PlaceCard from '../components/PlaceCard.vue'
import { orderBySpots, spotLabels } from '../utils/studySpots.js'
import HomeSearchBox from '../components/HomeSearchBox.vue'
import NotebookIntro from '../components/NotebookIntro.vue'
import AreaCarousel from '../components/AreaCarousel.vue'
import logoUrl from '../assets/logo.svg'

const router = useRouter()
const places = ref([])
const weather = ref(null)
const saved = ref([])
const loading = ref(true)
const q = ref('')
const root = ref(null)
const loggedIn = ref(isLoggedIn())

const INTRO_KEY = 'lk-notebook-opened'
function introSeen() {
  try { return sessionStorage.getItem(INTRO_KEY) === '1' } catch { return false }
}
const showIntro = ref(!introSeen() && !reducedMotion)
function introRevealed() { playHero() }
function introOpened() {
  showIntro.value = false
  try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* private mode */ }
  ScrollTrigger.refresh()
}

/* ---------- vibe picker: changes what "top picks" means ----------
 * rank(p) lists what the vibe cares about, most important first. Places are
 * sorted by those, then by our in-app rating, so the same vibe always shows
 * the same six. Weaker matches fill the rest when too few places fit. */
const CAFE_TYPES = ['cafe', 'coffee_shop', 'coffee_roastery', 'coffee_stand', 'tea_house']
const has = (p, facility) => (p.facilities || []).includes(facility)

// Open 24 hours on at least one day of the week
function open24h(p) {
  if (p.hours === '00:00 - 23:59') return true
  if ((p.weekdayHours || []).some(day => day.includes('Open 24 hours'))) return true
  const periods = p.openingPeriods || []
  return periods.length === 1 && !periods[0].close   // Google's way of saying 24/7
}

// Closing time from 'HH:MM - HH:MM' in minutes, so later closers rank higher
function closingMinutes(p) {
  const m = /- (\d{2}):(\d{2})$/.exec(p.hours || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

const VIBES = [
  { key: 'focus', label: 'Deep focus', note: 'Quiet and Conducive...', colour: 'var(--x-lilac)', rank: p => [has(p, 'quiet'), has(p, 'sockets')] },
  { key: 'group', label: 'Group grind', note: 'With Space to Chit Chat!', colour: 'var(--x-butter)', rank: p => [p.capacity || 0] },
  { key: 'cafe', label: 'Coffee & cram', note: 'Cafe Power!', colour: 'var(--x-orange)', rank: p => [CAFE_TYPES.includes(p.placeType)] },
  { key: 'night', label: 'Night owl', note: 'Open 24hrs...', colour: 'var(--x-sky)', rank: p => [open24h(p), closingMinutes(p)] },
]
const vibe = ref(VIBES[0])

function byVibe(a, b) {
  const ra = vibe.value.rank(a)
  const rb = vibe.value.rank(b)
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return rb[i] - ra[i]
  }
  return (b.rating || 0) - (a.rating || 0) ||
    (b.reviewCount || 0) - (a.reviewCount || 0) ||
    a.name.localeCompare(b.name)   // final tie-break keeps the order fixed
}

// The user's favourite kinds of spot (set at sign-up) come first, in vibe order
function storedSpots() {
  try { return JSON.parse(localStorage.getItem('user') || 'null')?.preferences?.studySpots || [] }
  catch { return [] }
}
const mySpots = ref(storedSpots())

const topPicks = computed(() => orderBySpots(places.value
  .filter(p => (p.closureStatus || 'normal') === 'normal')
  .sort(byVibe), mySpots.value)
  .slice(0, 6))

let switching = false
let pendingVibe = null
const selectedKey = ref(VIBES[0].key)
async function pickVibe(v) {
  selectedKey.value = v.key
  if (switching) { pendingVibe = v; return }
  if (v.key === vibe.value.key) return
  if (reducedMotion) { vibe.value = v; return }
  switching = true
  gsap.killTweensOf('.x-pick')
  await gsap.to('.x-pick', { autoAlpha: 0, y: 12, duration: 0.18, ease: 'power2.in' })
  vibe.value = v
  await nextTick()
  await gsap.fromTo('.x-pick', { autoAlpha: 0, y: 16 },
    { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.05 })
  switching = false
  if (pendingVibe) { const next = pendingVibe; pendingVibe = null; pickVibe(next) }
}

const marqueeNames = computed(() => places.value.map(p => p.name))
const openCount = computed(() => places.value.filter(p => p.openNow).length)
const planningCount = computed(() => places.value.reduce((t, p) => t + (p.intent?.count || 0), 0))
const areas = computed(() => {
  const byArea = {}
  for (const p of places.value) {
    if (!p.area) continue
    if (!byArea[p.area]) byArea[p.area] = []
    byArea[p.area].push(p)
  }
  return Object.entries(byArea)
    .map(([name, list]) => ({ name, list, photos: list.filter(p => p.photos?.length).slice(0, 3).map(p => p.photos[0]) }))
    .sort((a, b) => b.list.length - a.list.length)
    .slice(0, 7)
})

const stats = ref({ places: 0, open: 0, planning: 0, temp: 0 })

function search() {
  router.push({ path: '/search', query: q.value ? { q: q.value } : {} })
}
function answerYes() {
  router.push(isLoggedIn() ? '/search' : '/signup')
}
function goToPlace(place) {
  router.push(`/places/${place.id}`)
}
async function toggleSave(id) {
  if (!isLoggedIn()) { router.push('/login'); return }
  try {
    saved.value = await toggleSavedId(saved.value, id)
  } catch (e) {
    console.error('Could not update saved place', e)
  }
}

let ctx = null
let mm = null
let heroPlayed = false
let marqueeNudge = null

function playHero() {
  if (heroPlayed || reducedMotion || !ctx) return
  heroPlayed = true
  ctx.add(() => {
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from('.x-hero .x-char', { yPercent: 120, rotation: () => gsap.utils.random(-25, 25), duration: 1.1, stagger: 0.05 })
      .from('.x-hero__logo', { scale: 0, rotation: -180, duration: 1, ease: 'back.out(2)' }, 0.25)
      .from('.x-hero__kicker', { y: 20, autoAlpha: 0, duration: 0.7 }, 0.3)
      .from('.x-hero__line > *', { y: 30, autoAlpha: 0, duration: 0.8, stagger: 0.06 }, 0.45)
      .from('.x-hero__search', { y: 30, autoAlpha: 0, duration: 0.8 }, 0.7)
  })
}

function wobble(e) {
  if (reducedMotion) return
  gsap.fromTo(e.currentTarget, { rotation: 0, y: 0 },
    { keyframes: [{ rotation: gsap.utils.random(-14, 14), y: -18, duration: 0.18 }, { rotation: 0, y: 0, duration: 0.7, ease: 'elastic.out(1.2, .35)' }] })
}

function setupScrollAnimations() {
  if (reducedMotion || !ctx) return
  ctx.add(() => {
    mm = gsap.matchMedia()
    mm.add('(min-width: 768px)', () => {
      const track = document.querySelector('.x-areas__track')
      if (!track) return
      const distance = () => track.scrollWidth - window.innerWidth + 48
      const ride = gsap.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: { trigger: '.x-areas', start: 'top top', end: () => '+=' + distance() * 0.4, pin: true, scrub: 0.8, invalidateOnRefresh: true }
      })
      gsap.utils.toArray('.x-area__photo').forEach((photo, i) => {
        gsap.fromTo(photo, { y: 40 + (i % 3) * 20, rotation: (i % 2 ? 6 : -6) },
          {
            y: -30, rotation: (i % 2 ? -4 : 4), ease: 'none',
            scrollTrigger: { trigger: photo, containerAnimation: ride, start: 'left right', end: 'right left', scrub: true }
          })
      })
    })

    // The tracks hold every place name twice, so their length grows with the
    // list. Time each loop by its width for a steady, readable speed.
    const MARQUEE_PX_PER_SEC = 60
    const rows = gsap.utils.toArray('.x-marquee__track')
    const loops = rows.map((row, i) => {
      const duration = Math.max(20, row.scrollWidth / 2 / MARQUEE_PX_PER_SEC)
      return i % 2
        ? gsap.fromTo(row, { xPercent: -50 }, { xPercent: 0, duration, ease: 'none', repeat: -1 })
        : gsap.fromTo(row, { xPercent: 0 }, { xPercent: -50, duration, ease: 'none', repeat: -1 })
    })
    if (rows.length) ScrollTrigger.create({
      trigger: '.x-marquee', start: 'top bottom', end: 'bottom top',
      onUpdate: self => {
        // scrolling gives a small nudge (up to 2x) that eases back to normal.
        // Always forwards: a reversed loop sticks at its start.
        const boost = 1 + Math.min(1, Math.abs(self.getVelocity()) / 1500)
        marqueeNudge?.kill()
        marqueeNudge = gsap.timeline()
          .to(loops, { timeScale: boost, duration: 0.3 })
          .to('.x-marquee', { skewY: gsap.utils.clamp(-4, 4, self.getVelocity() / -600), duration: 0.4 }, 0)
          .to(loops, { timeScale: 1, duration: 1.2, ease: 'power2.out' })
          .to('.x-marquee', { skewY: 0, duration: 0.8, ease: 'power2.out' }, '<')
      },
    })

    gsap.utils.toArray('.x-reveal').forEach(el => {
      gsap.from(el.querySelectorAll('.x-word'), {
        yPercent: 110, rotation: 4, duration: 0.9, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: el, start: 'top 90%' },
      })
    })

    gsap.fromTo('.x-vibe', { y: 24, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 0.6,
      ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: '.x-vibes', start: 'top 90%' }
    })

    const target = { places: places.value.length, open: openCount.value, planning: planningCount.value, temp: weather.value?.temp ?? 0 }
    const obj = { places: 0, open: 0, planning: 0, temp: 0 }
    gsap.to(obj, {
      ...target, duration: 1.4, ease: 'power3.out',
      onUpdate: () => {
        stats.value = {
          places: Math.round(obj.places), open: Math.round(obj.open),
          planning: Math.round(obj.planning), temp: Math.round(obj.temp)
        }
      }
    })
    gsap.fromTo('.x-stat', { y: 30, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.7)', stagger: 0.08 })

    if (!loggedIn.value) gsap.from('.x-final .x-char', {
      yPercent: 100, opacity: 0, stagger: 0.03, ease: 'expo.out', duration: 0.9,
      scrollTrigger: { trigger: '.x-final', start: 'top 90%' }
    })

    if (finePointer) {
      gsap.utils.toArray('[data-magnetic]').forEach(el => {
        const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, .4)' })
        const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, .4)' })
        el.addEventListener('pointermove', e => {
          const b = el.getBoundingClientRect()
          mx((e.clientX - b.left - b.width / 2) * 0.35); my((e.clientY - b.top - b.height / 2) * 0.35)
        })
        el.addEventListener('pointerleave', () => { mx(0); my(0) })
      })
    }
  })
}

function animatePicks() {
  if (reducedMotion || !ctx) return
  ctx.add(() => {
    ScrollTrigger.batch('.x-pick', {
      start: 'top 90%', once: true,
      onEnter: els => gsap.fromTo(els, { y: 40, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: 0.08 }),
    })
  })
}

onMounted(async () => {
  ctx = gsap.context(() => { }, root.value)
  if (!showIntro.value) playHero()

  try {
    const [placeRes, w, ids] = await Promise.all([
      axios.get(`${BASE_URL}/places`),
      fetchWeather().catch(() => null),
      fetchSavedIds(),
    ])
    places.value = placeRes.data
    weather.value = w
    saved.value = ids
  } catch (e) {
    console.error('Failed to load places', e)
  } finally {
    loading.value = false
  }

  await nextTick()
  if (reducedMotion) {
    stats.value = { places: places.value.length, open: openCount.value, planning: planningCount.value, temp: weather.value?.temp ?? 0 }
  }
  setupScrollAnimations()
  animatePicks()
  ScrollTrigger.sort()
  ScrollTrigger.refresh()
})

watch(weather, w => { if (reducedMotion && w) stats.value.temp = w.temp })

onUnmounted(() => {
  mm?.revert()
  ctx?.revert()
})

const chars = text => text.split('')
const words = text => text.split(' ')
</script>

<template>
  <div ref="root" class="x-home">
    <Teleport to="body">
      <NotebookIntro v-if="showIntro" @reveal="introRevealed" @opened="introOpened" />
    </Teleport>

    <header class="x-hero">
      <div class="container x-hero__grid">
        <div class="x-hero__main">

          <h1 class="x-hero__title" aria-label="Lock in.">
            <span class="x-hero__row">
              <span v-for="(c, i) in chars('LOCK')" :key="'a' + i" class="x-char" aria-hidden="true"
                @mouseenter="wobble">{{ c }}</span>
              <img :src="logoUrl" alt="" class="x-hero__logo" aria-hidden="true">
            </span>
            <span class="x-hero__row x-hero__row--2">
              <span v-for="(c, i) in chars('IN.')" :key="'b' + i" class="x-char" aria-hidden="true"
                @mouseenter="wobble">{{ c }}</span>
              <span class="x-hero__aside x-serif">and actually<br>get stuff done</span>
            </span>
          </h1>

          <p class="x-hero__line">
            Find the best study spot for you to <span class="x-hl">focus!</span>
          </p>

          <div class="x-hero__search">
            <div class="ss-search x-search">
              <HomeSearchBox v-model="q" :places="places" @search="search" @select="goToPlace" />
            </div>
          </div>
        </div>

        <div class="x-stats" aria-label="LockedIN in numbers">
          <div class="x-stat x-stat--a"><b>{{ stats.places }}</b><span>study spots mapped</span></div>
          <div class="x-stat x-stat--b"><b>{{ stats.open }}</b><span>open right now</span></div>
          <div class="x-stat x-stat--c"><b>{{ stats.planning }}</b><span>people heading out next</span></div>
          <div class="x-stat x-stat--d"><b>{{ stats.temp }}°</b><span>outside</span></div>
        </div>
      </div>
    </header>

    <AreaCarousel v-if="!loggedIn" :areas="areas" />

    <section class="x-section container">
      <div class="x-head">
        <h2 class="x-reveal"><span v-for="(w, i) in words('What\'s the vibe today?')" :key="i" class="x-mask">
        <span class="x-word">{{ w }}</span></span></h2>
      </div>

      <div class="x-vibes" role="radiogroup" aria-label="Study vibe">
        <button v-for="v in VIBES" :key="v.key" type="button" class="x-vibe" role="radio"
          :aria-checked="selectedKey === v.key" :style="{ '--vibe': v.colour }"
          :data-cursor="selectedKey === v.key ? 'picked' : 'pick'" data-test="vibe" @click="pickVibe(v)">
          <span class="x-vibe__label">{{ v.label }}</span>
          <span class="x-vibe__note x-mono">{{ v.note }}</span>
        </button>
      </div>
      <p v-if="loggedIn && mySpots.length" class="x-spots-note x-mono" data-test="spots-note">
        Your favourite spots come first: {{ spotLabels(mySpots).join(', ') }} ·
        <RouterLink to="/profile">change</RouterLink>
      </p>

      <div v-if="loading" class="row g-2 g-sm-4">
        <div v-for="n in 3" :key="n" class="col-4">
          <div class="ss-card ss-skeleton" style="height:360px"></div>
        </div>
      </div>
      <div v-else class="row g-4 x-picks">
        <div v-for="place in topPicks" :key="place.id" class="col-4 x-pick"
          :data-flip-id="place.id">
          <PlaceCard :place="place" :saved="saved.includes(place.id)"
            @toggle-save="toggleSave" />
        </div>
      </div>

      <div class="text-center mt-5">
        <RouterLink to="/search" class="btn btn-primary btn-lg x-big-btn" data-magnetic data-cursor="go">Browse all {{
          places.length }} spots →</RouterLink>
      </div>
    </section>

    <AreaCarousel v-if="loggedIn" :areas="areas" />

    <div v-if="!loggedIn" class="x-marquee" aria-hidden="true">
      <div class="x-marquee__row">
        <div class="x-marquee__track">
          <span v-for="(n, i) in [...marqueeNames, ...marqueeNames]" :key="'m1' + i">{{ n }} <b>✶</b></span>
        </div>
      </div>
      <div class="x-marquee__row x-marquee__row--alt">
        <div class="x-marquee__track">
          <span v-for="(n, i) in [...marqueeNames, ...marqueeNames].reverse()" :key="'m2' + i">{{ n }} <b>●</b></span>
        </div>
      </div>
    </div>

    <section v-if="!loggedIn" class="x-final container">
      <p class="x-final__line" aria-label="Ready to lock in?">
        <template v-for="(w, wi) in words('Ready to lock in?')" :key="wi"><span class="x-wordbox"
            aria-hidden="true"><span v-for="(c, ci) in chars(w)" :key="ci" class="x-char">{{ c }}</span></span>{{ ' '
          }}</template>
      </p>
      <button type="button" class="btn btn-primary btn-lg x-yes" data-magnetic data-cursor="go" data-test="final-yes"
        @click="answerYes">Yes</button>
    </section>
  </div>
</template>

<style scoped>
.x-home {
  overflow-x: clip;
}

.x-hero {
  padding-top: 120px;
  padding-bottom: 2rem;
}

.x-hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 2.5rem;
  align-items: center;
}

.x-hero__kicker {
  color: var(--x-muted);
  margin-bottom: 1rem;
}

.x-hero__title {
  margin: 0;
  font-size: clamp(1.85rem, 7vw, 5.7rem);
  line-height: .85;
  letter-spacing: -.06em;
  font-weight: 800;
}

.x-hero__row {
  display: flex;
  align-items: center;
  overflow: visible;
}

.x-hero__row--2 {
  padding-left: 2.6vw;
}

.x-char {
  display: inline-block;
  will-change: transform;
}

.x-hero .x-char:nth-child(2) {
  color: var(--x-orange);
}

.x-hero__row--2 .x-char:first-child {
  -webkit-text-stroke: 3px var(--x-ink);
  color: transparent;
}

.x-hero__logo {
  width: clamp(24px, 4.3vw, 60px);
  margin-left: .6vw;
  animation: x-spin 18s linear infinite;
}

@keyframes x-spin {
  to {
    transform: rotate(360deg);
  }
}

.x-hero__aside {
  font-size: clamp(.85rem, 1vw, 1rem);
  line-height: 1;
  letter-spacing: 0;
  margin-left: 1vw;
  align-self: flex-end;
  margin-bottom: .6vw;
  color: var(--x-ink);
}

.x-hero__line {
  max-width: 560px;
  margin: 1.2rem 0 1.4rem;
  font-size: clamp(1rem, 1.1vw, 1.1rem);
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: -.01em;
}

.x-hl {
  background: var(--x-lime);
  padding: 0 .2em;
  border-radius: 8px;
  transform: rotate(-2deg);
  display: inline-block;
}

.x-hero__search {
  max-width: 560px;
  position: relative;
  z-index: 5;
}

.x-search {
  padding: 4px 4px 4px 14px;
}

.x-marquee {
  margin: 3rem 0;
  transform-origin: center;
}

.x-marquee__row {
  overflow: hidden;
  background: var(--x-ink);
  border-block: var(--x-line);
  transform: rotate(-2deg);
}

.x-marquee__row--alt {
  background: var(--x-lime);
  transform: rotate(1.5deg);
  margin-top: -10px;
}

.x-marquee__track {
  display: inline-flex;
  white-space: nowrap;
  padding: .7rem 0;
  will-change: transform;
}

.x-marquee__track span {
  font-weight: 800;
  font-size: clamp(1.4rem, 3vw, 2.4rem);
  letter-spacing: -.03em;
  color: var(--x-paper);
  padding-right: 1.2rem;
}

.x-marquee__row--alt .x-marquee__track span {
  color: var(--x-ink);
}

.x-marquee__track b {
  color: var(--x-orange);
  padding-left: 1rem;
}

.x-section {
  padding-top: 5rem;
  padding-bottom: 5rem;
}

.x-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 1.6rem;
}

.x-head h2 {
  margin: 0;
}

.x-mask {
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  /* right padding stops negative letter-spacing clipping the last glyph */
  padding: 0 .08em .08em 0;
  margin-right: .14em;
}

.x-word {
  display: inline-block;
}

.x-spots-note {
  margin: -0.5rem 0 1.5rem;
  font-size: .85rem;
}

.x-spots-note a { color: var(--x-ink); font-weight: 700; }

.x-vibes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 2rem;
}

.x-vibe {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  padding: 18px 18px 16px;
  border: var(--x-line);
  border-radius: 22px;
  background: var(--x-card);
  box-shadow: var(--x-pop);
  color: var(--x-ink);
  transition: transform .3s var(--x-ease), background-color .3s, box-shadow .3s var(--x-ease);
}

.x-vibe:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--x-ink);
}

.x-vibe[aria-checked="true"] {
  background: var(--vibe);
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--x-ink);
}

.x-vibes+.row {
  margin-top: 0;
}

.x-vibe__label {
  font-weight: 800;
  font-size: 1.35rem;
  letter-spacing: -.03em;
}

.x-vibe__note {
  color: var(--x-ink-2);
  font-size: .66rem;
}

.x-pick {
  will-change: transform;
}

.x-big-btn {
  font-size: 1.15rem;
  padding: .9rem 1.8rem;
}

.x-yes {
  font-size: 1.2rem;
  min-width: 160px;
  padding: .85rem 2.4rem;
}

.x-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.x-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 18px;
  border: var(--x-line);
  border-radius: 22px;
  box-shadow: var(--x-pop);
}

.x-stat b {
  font-size: clamp(2rem, 3.4vw, 3rem);
  font-weight: 800;
  line-height: .9;
  letter-spacing: -.06em;
}

.x-stat span {
  font-weight: 600;
  font-size: .88rem;
}

.x-stat--a {
  background: var(--x-butter);
  transform: rotate(-2deg);
}

.x-stat--b {
  background: var(--x-lime);
  transform: rotate(1.5deg);
}

.x-stat--c {
  background: var(--x-lilac);
  transform: rotate(-1deg);
}

.x-stat--d {
  background: var(--x-sky);
  transform: rotate(2deg);
}

.x-final {
  text-align: center;
  padding-block: 4rem 3rem;
}

.x-final__line {
  font-weight: 800;
  font-size: clamp(2rem, 7vw, 6rem);
  line-height: .9;
  letter-spacing: -.06em;
  margin-bottom: 1.6rem;
  overflow: hidden;
}

/* Below desktop: title and the 2x2 stats share the top row, the line and search
   go full width below, and all four vibes sit on one row. Sizes are fluid so
   phones and tablets get the same layout at a matching scale. */
@media (max-width: 991.98px) {
  .x-hero {
    padding-top: clamp(80px, 13vw, 120px);
    padding-bottom: 1rem;
  }

  .x-hero__grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      "title stats"
      "line line"
      "search search";
    gap: 0 clamp(12px, 3vw, 32px);
  }

  .x-hero__main {
    display: contents;
  }

  .x-hero__title {
    grid-area: title;
    align-self: center;
    font-size: clamp(2.9rem, 9vw, 5rem);
  }

  .x-stats {
    grid-area: stats;
    align-self: center;
    gap: clamp(7px, 1.6vw, 14px);
  }

  .x-hero__line {
    grid-area: line;
    max-width: none;
    margin: clamp(1rem, 2.4vw, 1.6rem) 0 clamp(.8rem, 1.8vw, 1.2rem);
    font-size: clamp(.95rem, 2vw, 1.1rem);
  }

  .x-hero__search {
    grid-area: search;
    max-width: none;
  }

  .x-hero__logo {
    width: clamp(28px, 5vw, 50px);
    margin-left: 4px;
  }

  .x-hero__aside {
    margin-left: clamp(7px, 1.2vw, 12px);
    margin-bottom: .4em;
    font-size: clamp(.72rem, 1.9vw, 1.05rem);
    white-space: nowrap;
  }

  .x-stat {
    gap: 1px;
    padding: clamp(6px, 1.6vw, 16px) clamp(7px, 1.8vw, 18px);
    border-radius: clamp(12px, 2.4vw, 22px);
  }

  .x-stat b {
    font-size: clamp(1.15rem, 4vw, 2.6rem);
  }

  .x-stat span {
    font-size: clamp(.56rem, 1.5vw, .9rem);
    line-height: 1.15;
  }

  .x-section {
    padding-top: clamp(2.5rem, 7vw, 5rem);
    padding-bottom: clamp(2.5rem, 7vw, 5rem);
  }

  .x-vibes {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(7px, 1.6vw, 16px);
    margin-bottom: clamp(1.25rem, 3vw, 2rem);
  }

  .x-vibe {
    gap: clamp(3px, .6vw, 5px);
    min-height: clamp(62px, 12vw, 110px);
    padding: clamp(7px, 1.8vw, 18px);
    border-radius: clamp(12px, 2.4vw, 22px);
  }

  .x-vibe__label {
    font-size: clamp(.74rem, 2.2vw, 1.35rem);
    line-height: 1.1;
    letter-spacing: -.02em;
  }

  .x-vibe__note {
    font-size: clamp(.6rem, 1.15vw, .66rem);
    line-height: 1.3;
    letter-spacing: .02em;
  }
}

@media (max-width: 767.98px) {
  .x-hero__row--2 {
    padding-left: 0;
  }
}

/* Phones: slimmer shadows and tighter spacing to suit the mini cards */
@media (max-width: 575.98px) {
  .x-hero__row--2 .x-char:first-child {
    -webkit-text-stroke: 2px var(--x-ink);
  }

  .x-search {
    padding: 2px 2px 2px 10px;
  }

  .x-stat {
    box-shadow: 2px 2px 0 var(--x-ink);
  }

  .x-head {
    margin-bottom: 1rem;
  }

  .x-vibe {
    box-shadow: 2px 2px 0 var(--x-ink);
  }

  .x-vibe:hover,
  .x-vibe[aria-checked="true"] {
    box-shadow: 3px 3px 0 var(--x-ink);
  }

  .x-picks {
    --bs-gutter-x: .5rem;
    --bs-gutter-y: .5rem;
  }

  .x-big-btn {
    font-size: .9rem;
    padding: .5rem 1.2rem;
  }

  .x-marquee {
    margin: 2rem 0;
  }

  .x-marquee__track span {
    font-size: 1.1rem;
  }

  .x-final {
    padding-block: 2.5rem 2rem;
  }

  .x-final__line {
    font-size: 2.2rem;
    margin-bottom: 1.1rem;
  }

  .x-yes {
    min-width: 120px;
    padding: .5rem 1.6rem;
    font-size: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .x-hero__logo {
    animation: none;
  }
}
</style>