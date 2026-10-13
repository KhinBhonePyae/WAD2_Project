<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { suitabilityScore } from '../utils/suitability.js'
import { fetchWeather } from '../utils/weather.js'
import { fetchSavedIds, toggleSavedId, isLoggedIn } from '../utils/saved.js'
import { gsap, ScrollTrigger, Flip, reducedMotion, finePointer } from '../utils/motion.js'
import PlaceCard from '../components/PlaceCard.vue'
import HomeSearchBox from '../components/HomeSearchBox.vue'
import NotebookIntro from '../components/NotebookIntro.vue'
import logoUrl from '../assets/logo.svg'

const router = useRouter()
const places = ref([])
const weather = ref(null)
const saved = ref([])
const loading = ref(true)
const q = ref('')
const root = ref(null)

/* ---------- notebook intro: once per browser tab ---------- */
const INTRO_KEY = 'lk-notebook-opened'
function introSeen() {
  try { return sessionStorage.getItem(INTRO_KEY) === '1' } catch { return false }
}
const showIntro = ref(!introSeen() && !reducedMotion)
function introRevealed() { playHero() }
function introOpened() {
  showIntro.value = false
  try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* private mode: plays again next time */ }
  ScrollTrigger.refresh()
}

/* ---------- vibe picker: changes what "top picks" means ---------- */
const VIBES = [
  { key: 'focus', label: 'Deep focus', note: 'quiet + sockets', colour: 'var(--x-lilac)', facilities: ['quiet', 'sockets'] },
  { key: 'group', label: 'Group grind', note: 'room to talk, food nearby', colour: 'var(--x-butter)', facilities: ['fnb', 'wifi', 'toilets'] },
  { key: 'cafe', label: 'Coffee & cram', note: 'Wi-Fi + caffeine', colour: 'var(--x-orange)', facilities: ['fnb', 'wifi'] },
  { key: 'night', label: 'Night owl', note: 'open till 9pm or later', colour: 'var(--x-sky)', facilities: ['wifi', 'sockets'], late: true },
]
const vibe = ref(VIBES[0])

function closesLate(p) {
  const m = /- (\d{2}):/.exec(p.hours || '')
  return m ? Number(m[1]) >= 21 : false
}

const topPicks = computed(() => places.value
  .map(p => ({
    place: p,
    score: Math.min(100, suitabilityScore(p, vibe.value.facilities, weather.value) + (vibe.value.late && closesLate(p) ? 12 : 0)),
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 6))

async function pickVibe(v) {
  if (v.key === vibe.value.key) return
  if (reducedMotion) { vibe.value = v; return }
  // finish any entrance animation first so Flip measures cards at full size
  gsap.killTweensOf('.x-pick')
  gsap.set('.x-pick', { autoAlpha: 1, y: 0, rotation: 0 })
  // FLIP: remember where every card is, change the order, then animate from old to new spots
  const state = Flip.getState('.x-pick')
  vibe.value = v
  await nextTick()
  Flip.from(state, {
    duration: 0.8, ease: 'power3.inOut', stagger: 0.03, absolute: true,
    onEnter: els => gsap.fromTo(els, { scale: 0.6, opacity: 0, rotation: -6 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.8)' }),
    onLeave: els => gsap.to(els, { scale: 0.6, opacity: 0, duration: 0.35 }),
  })
}

/* ---------- data for the other sections ---------- */
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
const AREA_COLOURS = ['var(--x-lime)', 'var(--x-lilac)', 'var(--x-butter)', 'var(--x-sky)', 'var(--x-pink)', 'var(--x-orange)', 'var(--x-lime)']

const stats = ref({ places: 0, open: 0, planning: 0, temp: 0 })

/* ---------- assistant teaser: typewriter of example questions ---------- */
const PROMPTS = [
  'quiet spot near SMU for four people this afternoon',
  'somewhere open past 9pm with sockets',
  'a café in Bugis that won\'t kick me out',
  'indoor, cold aircon, no crowds please',
]
const typed = ref('')
let typeTimer = null
function typeLoop(i = 0, c = 0, deleting = false) {
  const text = PROMPTS[i]
  typed.value = text.slice(0, c)
  let next = 45, ni = i, nc = c + 1, nd = deleting
  if (!deleting && c === text.length) { nd = true; next = 1800; nc = c }
  else if (deleting) { nc = c - 1; next = 22; if (c === 0) { nd = false; ni = (i + 1) % PROMPTS.length; nc = 0; next = 300 } }
  typeTimer = setTimeout(() => typeLoop(ni, nc, nd), next)
}

/* ---------- actions ---------- */
function search() {
  router.push({ path: '/places', query: q.value ? { q: q.value } : {} })
}
// "Ready to lock in?" -> new visitors sign up, logged-in users go straight to browsing
function answerYes() {
  router.push(isLoggedIn() ? '/places' : '/signup')
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

/* ---------- animation ---------- */
let ctx = null
let mm = null
let heroPlayed = false

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

// letters wobble when the cursor passes over them
function wobble(e) {
  if (reducedMotion) return
  gsap.fromTo(e.currentTarget, { rotation: 0, y: 0 },
    { keyframes: [{ rotation: gsap.utils.random(-14, 14), y: -18, duration: 0.18 }, { rotation: 0, y: 0, duration: 0.7, ease: 'elastic.out(1.2, .35)' }] })
}

function setupScrollAnimations() {
  if (reducedMotion || !ctx) return
  ctx.add(() => {
    // ScrollTriggers must be created in page order: the pinned area ride sits near the
    // top, and it adds scroll space that every trigger below it needs to account for.
    // explore by area: vertical scroll drives a horizontal ride (desktop only)
    mm = gsap.matchMedia()
    mm.add('(min-width: 768px)', () => {
        const track = document.querySelector('.x-areas__track')
        if (!track) return
        const distance = () => track.scrollWidth - window.innerWidth + 48
        const ride = gsap.to(track, { x: () => -distance(), ease: 'none',
          // end is 40% of the travel distance, so it takes much less scrolling to get past
          scrollTrigger: { trigger: '.x-areas', start: 'top top', end: () => '+=' + distance() * 0.4, pin: true, scrub: 0.8, invalidateOnRefresh: true } })
        gsap.utils.toArray('.x-area__photo').forEach((photo, i) => {
          gsap.fromTo(photo, { y: 40 + (i % 3) * 20, rotation: (i % 2 ? 6 : -6) },
            { y: -30, rotation: (i % 2 ? -4 : 4), ease: 'none',
              scrollTrigger: { trigger: photo, containerAnimation: ride, start: 'left right', end: 'right left', scrub: true } })
        })
    })

    // marquees: drift forever, and run faster/backwards with scroll speed
    const rows = gsap.utils.toArray('.x-marquee__track')
    // the text is duplicated, so sliding exactly half its width loops seamlessly;
    // the second row runs the other way (from -50% back to 0)
    const loops = rows.map((row, i) => i % 2
      ? gsap.fromTo(row, { xPercent: -50 }, { xPercent: 0, duration: 40, ease: 'none', repeat: -1 })
      : gsap.fromTo(row, { xPercent: 0 }, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 }))
    ScrollTrigger.create({
      trigger: '.x-marquee', start: 'top bottom', end: 'bottom top',
      onUpdate: self => {
        const speed = gsap.utils.clamp(-6, 6, self.getVelocity() / 300)
        loops.forEach(l => gsap.to(l, { timeScale: speed >= 0 ? 1 + speed : speed - 1, duration: 0.3, overwrite: true }))
        gsap.to('.x-marquee', { skewY: gsap.utils.clamp(-4, 4, self.getVelocity() / -600), duration: 0.4, overwrite: true })
      },
    })

    // section headings slide up word by word
    gsap.utils.toArray('.x-reveal').forEach(el => {
      gsap.from(el.querySelectorAll('.x-word'), {
        yPercent: 110, rotation: 4, duration: 0.9, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: el, start: 'top 90%' },
      })
    })

    // vibe buttons pop in
    gsap.fromTo('.x-vibe', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6,
      ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: '.x-vibes', start: 'top 90%' } })

    // stats are in the hero now, so they count up as soon as the data is in
    const target = { places: places.value.length, open: openCount.value, planning: planningCount.value, temp: weather.value?.temp ?? 0 }
    const obj = { places: 0, open: 0, planning: 0, temp: 0 }
    gsap.to(obj, { ...target, duration: 1.4, ease: 'power3.out',
      onUpdate: () => { stats.value = { places: Math.round(obj.places), open: Math.round(obj.open),
                                        planning: Math.round(obj.planning), temp: Math.round(obj.temp) } } })
    gsap.fromTo('.x-stat', { y: 30, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.7)', stagger: 0.08 })

    // big closing line fills in letter by letter
    gsap.from('.x-final .x-char', { yPercent: 100, opacity: 0, stagger: 0.03, ease: 'expo.out', duration: 0.9,
      scrollTrigger: { trigger: '.x-final', start: 'top 90%' } })

    // magnetic buttons pull towards the cursor
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

// top picks rise in whenever the list renders
function animatePicks() {
  if (reducedMotion || !ctx) return
  ctx.add(() => {
    ScrollTrigger.batch('.x-pick', {
      start: 'top 90%', once: true,
      // fromTo ends at fully visible, so a vibe switch mid-animation can't leave a card half-faded
      onEnter: els => gsap.fromTo(els, { y: 40, autoAlpha: 0 },
                                       { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: 0.08 }),
    })
  })
}

onMounted(async () => {
  ctx = gsap.context(() => {}, root.value)
  if (!showIntro.value) playHero()
  if (!reducedMotion) typeLoop()
  else typed.value = PROMPTS[0]

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
  ScrollTrigger.refresh()
})

watch(weather, w => { if (reducedMotion && w) stats.value.temp = w.temp })

onUnmounted(() => {
  clearTimeout(typeTimer)
  mm?.revert()
  ctx?.revert()
})

// helpers for the template
const chars = text => text.split('')
const words = text => text.split(' ')
</script>

<template>
  <div ref="root" class="x-home">
    <!-- Teleported to <body>: the page-transition wrapper uses transform, which would
         otherwise trap this fixed overlay inside the (very tall) page -->
    <Teleport to="body">
      <NotebookIntro v-if="showIntro" @reveal="introRevealed" @opened="introOpened" />
    </Teleport>

    <!-- ===== HERO ===== -->
    <header class="x-hero">
      <div class="container x-hero__grid">
        <div class="x-hero__main">

        <h1 class="x-hero__title" aria-label="Lock in.">
          <span class="x-hero__row">
            <span v-for="(c, i) in chars('LOCK')" :key="'a' + i" class="x-char" aria-hidden="true" @mouseenter="wobble">{{ c }}</span>
            <img :src="logoUrl" alt="" class="x-hero__logo" aria-hidden="true">
          </span>
          <span class="x-hero__row x-hero__row--2">
            <span v-for="(c, i) in chars('IN.')" :key="'b' + i" class="x-char" aria-hidden="true" @mouseenter="wobble">{{ c }}</span>
            <span class="x-hero__aside x-serif">and actually<br>get stuff done</span>
          </span>
        </h1>

        <p class="x-hero__line">
          Find the spot where you <span class="x-hl">focus</span> — libraries, cafés and campus corners, ranked live.
        </p>

        <div class="x-hero__search">
          <div class="ss-search x-search">
            <HomeSearchBox v-model="q" :places="places" @search="search" @select="goToPlace" />
          </div>
        </div>
        </div>

        <!-- numbers sit beside the intro so the key facts are visible without scrolling -->
        <div class="x-stats" aria-label="LockIN in numbers">
          <div class="x-stat x-stat--a"><b>{{ stats.places }}</b><span>study spots mapped</span></div>
          <div class="x-stat x-stat--b"><b>{{ stats.open }}</b><span>open right now</span></div>
          <div class="x-stat x-stat--c"><b>{{ stats.planning }}</b><span>people heading out next</span></div>
          <div class="x-stat x-stat--d"><b>{{ stats.temp }}°</b><span>outside, live</span></div>
        </div>
      </div>
    </header>

    <!-- ===== EXPLORE BY AREA (pinned horizontal ride) ===== -->
    <section class="x-areas" aria-label="Explore by area">
      <div class="x-areas__track">
        <div class="x-areas__intro">
          <h2 class="x-reveal"><span v-for="(w, i) in words('Explore by area')" :key="i" class="x-mask"><span class="x-word">{{ w }}</span></span></h2>
        </div>
        <RouterLink v-for="(a, i) in areas" :key="a.name" :to="{ path: '/places', query: { q: a.name } }"
                    class="x-area" :style="{ '--area': AREA_COLOURS[i] }" data-cursor="explore">
          <span class="x-area__count x-mono">{{ String(i + 1).padStart(2, '0') }} · {{ a.list.length }} spot{{ a.list.length === 1 ? '' : 's' }}</span>
          <span class="x-area__name">{{ a.name }}</span>
          <span class="x-area__photos">
            <img v-for="(src, j) in a.photos" :key="j" :src="src" alt="" class="x-area__photo" loading="lazy">
          </span>
        </RouterLink>
      </div>
    </section>


    <!-- ===== VIBE + TOP PICKS ===== -->
    <section class="x-section container">
      <div class="x-head">
        <h2 class="x-reveal"><span v-for="(w, i) in words('What\'s the vibe today?')" :key="i" class="x-mask"><span class="x-word">{{ w }}</span></span></h2>
        <p class="ss-meta">Pick one and your top six reshuffle, live.</p>
      </div>

      <div class="x-vibes" role="radiogroup" aria-label="Study vibe">
        <button v-for="v in VIBES" :key="v.key" type="button" class="x-vibe" role="radio"
                :aria-checked="vibe.key === v.key" :style="{ '--vibe': v.colour }"
                :data-cursor="vibe.key === v.key ? 'picked' : 'pick'" data-test="vibe" @click="pickVibe(v)">
          <span class="x-vibe__label">{{ v.label }}</span>
          <span class="x-vibe__note x-mono">{{ v.note }}</span>
        </button>
      </div>

      <div v-if="loading" class="row g-4">
        <div v-for="n in 3" :key="n" class="col-12 col-md-6 col-lg-4">
          <div class="ss-card ss-skeleton" style="height:360px"></div>
        </div>
      </div>
      <div v-else class="row g-4 x-picks">
        <div v-for="item in topPicks" :key="item.place.id" class="col-12 col-md-6 col-lg-4 x-pick" :data-flip-id="item.place.id">
          <PlaceCard :place="item.place" :score="item.score" :saved="saved.includes(item.place.id)" @toggle-save="toggleSave" />
        </div>
      </div>

      <div class="text-center mt-5">
        <RouterLink to="/places" class="btn btn-primary btn-lg x-big-btn" data-magnetic data-cursor="go">Browse all {{ places.length }} spots →</RouterLink>
      </div>
    </section>

    <!-- ===== MARQUEE ===== -->
    <div class="x-marquee" aria-hidden="true">
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

    <!-- ===== ASSISTANT TEASER ===== -->
    <section class="x-section container">
      <div class="x-ai">
        <div class="x-ai__blob" aria-hidden="true"></div>
        <div class="x-ai__text">
          <span class="x-mono x-ai__soon">coming soon</span>
          <h2 class="x-reveal"><span v-for="(w, i) in words('Just tell it what you need.')" :key="i" class="x-mask"><span class="x-word">{{ w }}</span></span></h2>
          <div class="x-ai__prompt">
            <span class="x-mono">ask lockin ›</span>
            <span class="x-ai__typed">{{ typed }}<i class="x-caret"></i></span>
          </div>
          <button class="btn btn-accent" disabled title="Coming in a later sprint">Ask the assistant</button>
        </div>
      </div>
    </section>

    <!-- ===== FINAL CTA ===== -->
    <section class="x-final container">
      <p class="x-final__line" aria-label="Ready to lock in?">
        <template v-for="(w, wi) in words('Ready to lock in?')" :key="wi"><span class="x-wordbox" aria-hidden="true"><span v-for="(c, ci) in chars(w)" :key="ci" class="x-char">{{ c }}</span></span>{{ ' ' }}</template>
      </p>
      <button type="button" class="btn btn-primary btn-lg x-yes" data-magnetic data-cursor="go" data-test="final-yes" @click="answerYes">Yes</button>
    </section>
  </div>
</template>

<style scoped>
.x-home { overflow-x: clip; }

/* ---------- hero ---------- */
.x-hero { padding-top: 120px; padding-bottom: 2rem; }
.x-hero__grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 2.5rem; align-items: center; }
.x-hero__kicker { color: var(--x-muted); margin-bottom: 1rem; }
/* one third of the original giant size */
.x-hero__title { margin: 0; font-size: clamp(1.85rem, 7vw, 5.7rem); line-height: .85; letter-spacing: -.06em; font-weight: 800; }
.x-hero__row { display: flex; align-items: center; overflow: visible; }
.x-hero__row--2 { padding-left: 2.6vw; }
.x-char { display: inline-block; will-change: transform; }
.x-hero .x-char:nth-child(2) { color: var(--x-orange); }
.x-hero__row--2 .x-char:first-child { -webkit-text-stroke: 3px var(--x-ink); color: transparent; }
.x-hero__logo { width: clamp(24px, 4.3vw, 60px); margin-left: .6vw; animation: x-spin 18s linear infinite; }
@keyframes x-spin { to { transform: rotate(360deg); } }
.x-hero__aside { font-size: clamp(.85rem, 1vw, 1rem); line-height: 1; letter-spacing: 0; margin-left: 1vw;
                 align-self: flex-end; margin-bottom: .6vw; color: var(--x-ink); }

/* a third of the old size would be unreadable on phones, so it bottoms out at body size */
.x-hero__line { max-width: 560px; margin: 1.2rem 0 1.4rem; font-size: clamp(1rem, 1.1vw, 1.1rem); font-weight: 600;
                line-height: 1.45; letter-spacing: -.01em; }
.x-hl { background: var(--x-lime); padding: 0 .2em; border-radius: 8px; transform: rotate(-2deg); display: inline-block; }

.x-hero__search { max-width: 560px; position: relative; z-index: 5; }
.x-search { padding: 4px 4px 4px 14px; }

/* ---------- marquee ---------- */
.x-marquee { margin: 3rem 0; transform-origin: center; }
.x-marquee__row { overflow: hidden; background: var(--x-ink); border-block: var(--x-line); transform: rotate(-2deg); }
.x-marquee__row--alt { background: var(--x-lime); transform: rotate(1.5deg); margin-top: -10px; }
.x-marquee__track { display: inline-flex; white-space: nowrap; padding: .7rem 0; will-change: transform; }
.x-marquee__track span { font-weight: 800; font-size: clamp(1.4rem, 3vw, 2.4rem); letter-spacing: -.03em;
                         color: var(--x-paper); padding-right: 1.2rem; }
.x-marquee__row--alt .x-marquee__track span { color: var(--x-ink); }
.x-marquee__track b { color: var(--x-orange); padding-left: 1rem; }

/* ---------- sections ---------- */
.x-section { padding-top: 5rem; padding-bottom: 5rem; }
.x-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 1rem; margin-bottom: 1.6rem; }
.x-head h2 { margin: 0; }
.x-mask { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .08em; margin-right: .22em; }
.x-word { display: inline-block; }

.x-vibes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 2rem; }
.x-vibe { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;
          padding: 18px 18px 16px; border: var(--x-line); border-radius: 22px; background: var(--x-card);
          box-shadow: var(--x-pop); color: var(--x-ink);
          transition: transform .3s var(--x-ease), background-color .3s, box-shadow .3s var(--x-ease); }
.x-vibe:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--x-ink); }
.x-vibe[aria-checked="true"] { background: var(--vibe); transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--x-ink); }
/* Bootstrap's .row pulls itself up by the gutter; cancel that so cards never ride up into the tiles */
.x-vibes + .row { margin-top: 0; }
.x-vibe__label { font-weight: 800; font-size: 1.35rem; letter-spacing: -.03em; }
.x-vibe__note { color: var(--x-ink-2); font-size: .66rem; }
.x-pick { will-change: transform; }

.x-big-btn { font-size: 1.15rem; padding: .9rem 1.8rem; }
.x-yes { font-size: 1.2rem; min-width: 160px; padding: .85rem 2.4rem; }

/* ---------- stats ---------- */
.x-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.x-stat { display: flex; flex-direction: column; gap: 2px; padding: 16px 18px; border: var(--x-line); border-radius: 22px;
          box-shadow: var(--x-pop); }
.x-stat b { font-size: clamp(2rem, 3.4vw, 3rem); font-weight: 800; line-height: .9; letter-spacing: -.06em; }
.x-stat span { font-weight: 600; font-size: .88rem; }
.x-stat--a { background: var(--x-butter); transform: rotate(-2deg); }
.x-stat--b { background: var(--x-lime); transform: rotate(1.5deg); }
.x-stat--c { background: var(--x-lilac); transform: rotate(-1deg); }
.x-stat--d { background: var(--x-sky); transform: rotate(2deg); }

/* ---------- areas ---------- */
.x-areas { overflow: hidden; padding: 4rem 0; }
.x-areas__track { display: flex; align-items: stretch; gap: 24px; padding-inline: 24px; width: max-content; will-change: transform; }
.x-areas__intro { width: min(420px, 80vw); display: flex; flex-direction: column; justify-content: center; }
.x-area { position: relative; width: min(460px, 82vw); min-height: min(68vh, 560px); flex-shrink: 0;
          display: flex; flex-direction: column; padding: 26px; overflow: hidden;
          background: var(--area); border: var(--x-line); border-radius: 30px; box-shadow: var(--x-pop-lg);
          color: var(--x-ink); text-decoration: none; transition: transform .4s var(--x-ease); }
.x-area:hover { transform: rotate(-1.5deg) scale(1.02); }
.x-area__count { font-size: .72rem; }
.x-area__name { font-weight: 800; font-size: clamp(2.6rem, 5vw, 4.2rem); letter-spacing: -.05em; line-height: .9; margin-top: .4rem; }
.x-area__photos { position: relative; flex: 1; margin-top: 1rem; }
.x-area__photo { position: absolute; width: 58%; aspect-ratio: 4 / 5; object-fit: cover; border: var(--x-line);
                 border-radius: 18px; box-shadow: var(--x-pop); }
.x-area__photo:nth-child(1) { left: 0; bottom: 0; }
.x-area__photo:nth-child(2) { right: 0; top: 0; }
.x-area__photo:nth-child(3) { left: 24%; bottom: 8%; width: 46%; }

/* ---------- assistant teaser ---------- */
.x-ai { position: relative; overflow: hidden; display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 1.5rem;
        max-width: 860px; margin-inline: auto;
        padding: clamp(18px, 3vw, 30px); background: var(--x-ink); color: var(--x-paper);
        border: var(--x-line); border-radius: 34px; box-shadow: 8px 8px 0 var(--x-orange); }
.x-ai h2 { color: var(--x-paper); font-size: clamp(1.4rem, 2.6vw, 2rem); margin-bottom: .2rem; }
.x-ai__blob { aspect-ratio: 1; width: 100%; max-width: 120px; justify-self: center;
              background: conic-gradient(from 0deg, var(--x-orange), var(--x-lilac), var(--x-lime), var(--x-sky), var(--x-orange));
              border-radius: 42% 58% 63% 37% / 41% 44% 56% 59%; filter: blur(1px);
              animation: x-morph 9s ease-in-out infinite, x-spin 22s linear infinite; }
@keyframes x-morph {
  33% { border-radius: 63% 37% 41% 59% / 56% 59% 41% 44%; }
  66% { border-radius: 37% 63% 51% 49% / 37% 45% 55% 63%; }
}
.x-ai__soon { color: var(--x-lime); }
.x-ai__prompt { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin: .6rem 0 .9rem; padding: 10px 14px;
                background: rgba(243, 238, 227, .08); border: 1.5px solid rgba(243, 238, 227, .3); border-radius: 18px; }
.x-ai__prompt .x-mono { color: var(--x-lime); }
.x-ai__typed { font-size: .98rem; min-height: 1.4em; }
.x-caret { display: inline-block; width: 2px; height: 1.1em; margin-left: 2px; vertical-align: text-bottom;
           background: var(--x-lime); animation: x-blink 1s steps(1) infinite; }
@keyframes x-blink { 50% { opacity: 0; } }

/* ---------- final ---------- */
.x-final { text-align: center; padding-block: 4rem 3rem; }
.x-final__line { font-weight: 800; font-size: clamp(2rem, 7vw, 6rem); line-height: .9; letter-spacing: -.06em;
                 margin-bottom: 1.6rem; overflow: hidden; }

@media (max-width: 991.98px) {
  .x-vibes { grid-template-columns: repeat(2, 1fr); }
  .x-hero__grid { grid-template-columns: 1fr; gap: 1.6rem; }
  .x-ai { grid-template-columns: 1fr; }
  .x-ai__blob { max-width: 90px; }
}
@media (max-width: 767.98px) {
  /* no pinning on phones: swipe sideways instead */
  .x-areas { overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
  .x-area, .x-areas__intro { scroll-snap-align: center; }
  .x-area { min-height: 440px; }
  .x-hero { padding-top: 96px; }
  .x-hero__row--2 { padding-left: 0; }
  .x-hero__aside { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .x-hero__logo, .x-ai__blob, .x-caret { animation: none; }
}
</style>
