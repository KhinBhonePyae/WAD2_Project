<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { suitabilityScore } from '../utils/suitability.js'
import { fetchWeather } from '../utils/weather.js'
import { fetchSavedIds, toggleSavedId, isLoggedIn } from '../utils/saved.js'
import PlaceCard from '../components/PlaceCard.vue'
import FilterChips from '../components/FilterChips.vue'
import WeatherStage from '../components/WeatherStage.vue'
import { gsap, ScrollTrigger, reducedMotion } from '../utils/motion.js'

const route = useRoute()
const router = useRouter()
const places = ref([])
const weather = ref(null)
const saved = ref([])
const loading = ref(true)
const q = ref(route.query.q || '')

const FACILITY_OPTIONS = [
  { value: 'wifi', label: 'Wi-Fi' }, { value: 'sockets', label: 'Power sockets' },
  { value: 'quiet', label: 'Quiet' }, { value: 'fnb', label: 'Food & drink' },
  { value: 'water', label: 'Water point' }, { value: 'toilets', label: 'Toilets' },
]
const wanted = ref([])
const indoorOnly = ref(false)
const outdoorOnly = ref(false)
const openOnly = ref(false)

function toggleFacility(v) {
  wanted.value = wanted.value.includes(v) ? wanted.value.filter(x => x !== v) : [...wanted.value, v]
}
function toggleIndoor() {
  indoorOnly.value = !indoorOnly.value
  if (indoorOnly.value) outdoorOnly.value = false
}
function toggleOutdoor() {
  outdoorOnly.value = !outdoorOnly.value
  if (outdoorOnly.value) indoorOnly.value = false
}
function clearAll() {
  wanted.value = []; indoorOnly.value = false; outdoorOnly.value = false; openOnly.value = false; q.value = ''
}
async function toggleSave(id) {
  if (!isLoggedIn()) {
    router.push('/login')
    return
  }
  try {
    saved.value = await toggleSavedId(saved.value, id)
  } catch (e) {
    console.error('Could not update saved place', e)
  }
}

const results = computed(() => {
  let list = places.value
  const term = q.value.trim().toLowerCase()
  if (term) {
    list = list.filter(p => p.name.toLowerCase().includes(term) ||
                            (p.area || '').toLowerCase().includes(term))
  }
  if (wanted.value.length) list = list.filter(p => wanted.value.every(f => p.facilities.includes(f)))
  if (indoorOnly.value)  list = list.filter(p => p.indoor)
  if (outdoorOnly.value) list = list.filter(p => !p.indoor)
  if (openOnly.value)    list = list.filter(p => p.openNow)

  return list
    .map(p => ({ place: p, score: suitabilityScore(p, wanted.value, weather.value) }))
    .sort((a, b) => b.score - a.score)
})

async function load() {
  loading.value = true
  try {
    const [res, w, ids] = await Promise.all([
      axios.get(`${BASE_URL}/places`),
      fetchWeather().catch(() => null),
      fetchSavedIds(),
    ])
    places.value = res.data
    weather.value = w
    saved.value = ids
  } catch (e) {
    console.error('Failed to load places', e)
  } finally {
    loading.value = false
  }
}
let ctx = null
onMounted(async () => {
  ctx = gsap.context(() => {
    if (!reducedMotion) gsap.from('.x-page-title .x-word', { yPercent: 110, rotation: 5, duration: 1, ease: 'expo.out', stagger: 0.08 })
  })
  await load()
  animateCards()
})
onUnmounted(() => ctx?.revert())

// cards pop in as they scroll into view (re-run whenever the filtered list changes)
async function animateCards() {
  if (reducedMotion || !ctx) return
  await nextTick()
  ctx.add(() => {
    ScrollTrigger.batch('.x-cat-card:not(.x-seen)', {
      start: 'top 92%', once: true,
      onEnter: els => {
        els.forEach(e => e.classList.add('x-seen'))
        gsap.from(els, { y: 60, rotation: () => gsap.utils.random(-5, 5), autoAlpha: 0, duration: 0.7, ease: 'back.out(1.5)', stagger: 0.07 })
      },
    })
    ScrollTrigger.refresh()
  })
}
watch(results, animateCards)
watch(() => route.query.q, v => { q.value = v || '' })
</script>

<template>
  <main class="container ss-section">
    <div class="ss-section__head">
      <div>
        <h1 class="mb-1 x-page-title" aria-label="Study spaces"><span class="x-mask"><span class="x-word">Study</span></span> <span class="x-mask"><span class="x-word">spaces</span></span></h1>
        <p class="ss-muted mb-0" data-test="result-count">
          {{ loading ? 'Loading…' : results.length + ' spot' + (results.length === 1 ? '' : 's') + ' match your filters' }}
        </p>
      </div>
    </div>

    <div class="ss-search mb-3">
      <span class="ss-muted" aria-hidden="true">⌕</span>
      <input v-model="q" type="text" placeholder="Search by name or area"
             aria-label="Search study spaces" data-test="cat-search">
    </div>

    <WeatherStage :weather="weather" area="Singapore" compact class="mb-4" />

    <div class="mb-3">
      <div class="ss-meta mb-2">Must have</div>
      <FilterChips :options="FACILITY_OPTIONS" :selected="wanted" @toggle="toggleFacility" />
    </div>

    <div class="d-flex flex-wrap gap-2 mb-4">
      <button class="ss-chip" :aria-pressed="openOnly" @click="openOnly = !openOnly" data-test="chip-open">Open now</button>
      <button class="ss-chip" :aria-pressed="indoorOnly"
              @click="toggleIndoor" data-test="chip-indoor">Indoor</button>
      <button class="ss-chip" :aria-pressed="outdoorOnly"
              @click="toggleOutdoor" data-test="chip-outdoor">Outdoor</button>
      <button class="btn btn-ghost btn-sm ms-auto" @click="clearAll" data-test="clear-filters">Clear filters</button>
    </div>

    <div v-if="loading" class="row g-3">
      <div v-for="n in 6" :key="n" class="col-12 col-md-6 col-lg-4">
        <div class="ss-card">
          <div class="ss-card__media ss-skeleton"></div>
          <div class="ss-card__body">
            <div class="ss-skeleton" style="height:22px;width:70%"></div>
            <div class="ss-skeleton" style="height:14px;width:45%"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!results.length" class="ss-empty" data-test="empty-state">
      <div class="x-empty-icon" aria-hidden="true">?</div>
      <p class="mb-2" style="font-weight:600;color:var(--ss-text)">No spots match those filters</p>
      <p class="mb-3">Try removing a filter or widening the area.</p>
      <button class="btn btn-outline-primary btn-sm" @click="clearAll">Clear filters</button>
    </div>

    <div v-else class="row g-4">
      <div v-for="item in results" :key="item.place.id" class="col-12 col-md-6 col-lg-4 x-cat-card">
        <PlaceCard :place="item.place" :score="item.score"
                   :saved="saved.includes(item.place.id)" @toggle-save="toggleSave" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.x-mask { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .08em; }
.x-empty-icon { width: 64px; height: 64px; margin: 0 auto 12px; display: grid; place-items: center; border-radius: 50%;
                background: var(--x-butter); border: var(--x-line); box-shadow: var(--x-pop); font-weight: 800; font-size: 2rem; }
</style>
