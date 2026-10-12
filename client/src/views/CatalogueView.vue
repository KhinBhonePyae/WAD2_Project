<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { suitabilityScore } from '../utils/suitability.js'
import { fetchWeather } from '../utils/weather.js'
import PlaceCard from '../components/PlaceCard.vue'
import FilterChips from '../components/FilterChips.vue'
import WeatherScene from '../components/WeatherScene.vue'

const route = useRoute()
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
function toggleSave(id) {
  saved.value = saved.value.includes(id) ? saved.value.filter(x => x !== id) : [...saved.value, id]
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
    const [res, w] = await Promise.all([
      axios.get(`${BASE_URL}/places`),
      fetchWeather().catch(() => null),
    ])
    places.value = res.data
    weather.value = w
  } catch (e) {
    console.error('Failed to load places', e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => route.query.q, v => { q.value = v || '' })
</script>

<template>
  <main class="container ss-section">
    <div class="ss-section__head">
      <div>
        <h1 class="mb-1">Study spaces</h1>
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

    <WeatherScene :weather="weather" class="mb-4" />

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
      <div style="font-size:2rem">🔍</div>
      <p class="mb-2" style="font-weight:600;color:var(--ss-text)">No spots match those filters</p>
      <p class="mb-3">Try removing a filter or widening the area.</p>
      <button class="btn btn-outline-primary btn-sm" @click="clearAll">Clear filters</button>
    </div>

    <div v-else class="row g-3">
      <div v-for="item in results" :key="item.place.id" class="col-12 col-md-6 col-lg-4 ss-rise">
        <PlaceCard :place="item.place" :score="item.score"
                   :saved="saved.includes(item.place.id)" @toggle-save="toggleSave" />
      </div>
    </div>
  </main>
</template>
