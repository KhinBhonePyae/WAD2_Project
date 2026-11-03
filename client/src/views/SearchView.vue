<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import HomeSearchBox from '../components/HomeSearchBox.vue'
import SearchFilters from '../components/SearchFilters.vue'
import PlaceCard from '../components/PlaceCard.vue'
import WeatherBackdrop from '../components/WeatherBackdrop.vue'
import { previewSky } from '../utils/weatherPreview.js'
import CustomSelect from '../components/CustomSelect.vue'
import { suitabilityBreakdown, preferencesToWanted } from '../utils/suitability'
import { DEFAULT_PREFS, filterPlaces, prefsFromUserPreferences, sortByDistance, distanceKm, placeCoords } from '../utils/searchFilters'
import { orderBySpots, spotMatches, spotLabels } from '../utils/studySpots'
import { BASE_URL } from '../utils/api'
import { fetchWeather } from '../utils/weather'
import { fetchSavedIds, toggleSavedId, isLoggedIn } from '../utils/saved'

const MANUAL_KEY = 'studyspot_search_prefs_manual'
const STORAGE_KEY = 'studyspot_search_prefs'
const USER_KEY = 'user'

const route = useRoute()
const router = useRouter()

const query = ref(route.query.q || '')
const prefs = ref({ ...DEFAULT_PREFS, facilities: [] })
const sortBy = ref('score')
const spaces = ref([])
const facilityOptions = ref([])
const areaOptions = ref([])
const loading = ref(false)
const error = ref('')
const weather = ref(null)
const saved = ref([])

const ITEMS_PER_PAGE = 12
const currentPage = ref(1)
const resultsContainer = ref(null)

const sortOptions = [
  { value: 'score', label: 'Best match' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'name', label: 'Name (A–Z)' }
]

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') }
  catch { return null }
}

// Filters the user set by hand last time; otherwise none. Profile preferences
// only change the order (see results), so no place is hidden by default.
function initialPrefs() {
  if (localStorage.getItem(MANUAL_KEY) === '1') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return { ...DEFAULT_PREFS, facilities: [], ...JSON.parse(saved) } }
      catch { /* corrupt entry — fall back to no filters */ }
    }
  }
  return { ...DEFAULT_PREFS, facilities: [] }
}

const myPrefs = readStoredUser()?.preferences || {}
const mySpots = myPrefs.studySpots || []

const hasUserPreferences = computed(() => {
  const p = readStoredUser()?.preferences
  return !!p && !!(p.wifiRequired || p.socketsRequired || p.quietPreferred || p.indoorPreferred)
})

async function fetchResults() {
  currentPage.value = 1
  loading.value = true
  error.value = ''
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        q: query.value,
        facilities: prefs.value.facilities.join(','),
        strict: prefs.value.strictFacilities,
        area: prefs.value.area,
        minRating: prefs.value.minRating,
      },
    })
    spaces.value = response.data.results
    facilityOptions.value = response.data.facilityOptions
    areaOptions.value = response.data.areaOptions
  } catch (e) {
    error.value = 'Could not load study spaces: ' + e.message
    spaces.value = []
  } finally {
    loading.value = false
  }
}

function search(searchTerm) {
  if (typeof searchTerm === 'string') {
    query.value = searchTerm
  }
  
  if (query.value !== (route.query.q || '')) {
    router.replace({ query: { ...route.query, q: query.value || undefined } })
  }
  
  fetchResults()

  nextTick(() => {
    // When searching from the search bar, still scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

function goToPlace(place) {
  router.push(`/places/${place.id}`)
}

async function toggleSave(id) {
  if (!isLoggedIn()) { 
    router.push('/login'); 
    return 
  }
  try {
    saved.value = await toggleSavedId(saved.value, id)
  } catch (e) {
    console.error('Could not update saved place', e)
  }
}

// Score against the facilities picked in the filters, or else the user's must-haves
const scoreWanted = computed(() => prefs.value.facilities.length ? prefs.value.facilities : preferencesToWanted(myPrefs))

const results = computed(() => {
  const scored = spaces.value.map((s) => ({
    ...s,
    ...suitabilityBreakdown(s, scoreWanted.value, weather.value),
  }))
  
  let list = filterPlaces(scored, prefs.value)

  if (prefs.value.nearbyOnly && prefs.value.userLocation) {
    list = sortByDistance(list, prefs.value.userLocation)
  } else {
    if (sortBy.value === 'score') list = orderBySpots(list.sort((a, b) => b.score - a.score), mySpots)
    else if (sortBy.value === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    else if (sortBy.value === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  return list
})

// Small extras on each card: distance when we know where the user is, and a
// marker when the place is one of their favourite kinds of spot
function cardTags(space) {
  const tags = []
  const here = prefs.value.userLocation
  const there = placeCoords(space)
  if (here && there) {
    const km = distanceKm(here, there)
    if (km <= (Number(prefs.value.radiusKm) || DEFAULT_PREFS.radiusKm)) {
      tags.push('📍 Nearby · ' + (km < 1 ? Math.round(km * 1000 / 10) * 10 + ' m' : km.toFixed(1) + ' km'))
    }
  }
  const matches = spotMatches(space, mySpots)
  if (matches.length) tags.push('★ Your pick: ' + spotLabels(matches).join(', '))
  return tags
}

// TESTING ONLY: weather background switcher (see the template)
const WEATHER_PREVIEWS = [
  { key: '', label: 'Live' },
  { key: 'clear', label: '☀️ Clear' },
  { key: 'cloudy', label: '☁️ Cloudy' },
  { key: 'rain', label: '🌧 Rain' },
  { key: 'night', label: '🌙 Night' },
]
const showWeatherTester = import.meta.env.DEV || route.query.weather === 'test'
const showBackdrop = ref(true)   // TESTING: compare the page background with the nav weather alone

const weatherLine = computed(() => {
  const w = weather.value
  if (!w) return ''
  const advice = w.raining ? 'indoor spots rank higher' : !w.isDay ? 'check closing times' : 'good for outdoor spots too'
  return `${w.icon} ${w.temp}° · ${w.label} · ${advice}`
})

const totalPages = computed(() => Math.ceil(results.value.length / ITEMS_PER_PAGE) || 1)

const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return results.value.slice(start, start + ITEMS_PER_PAGE)
})

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (current <= 3) {
    return [1, 2, 3, 4, '...', total]
  }
  if (current >= total - 2) {
    return [1, '...', total - 3, total - 2, total - 1, total]
  }
  return [1, '...', current - 1, current, current + 1, '...', total]
})

async function changePage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    await nextTick()
    
    if (resultsContainer.value) {
      setTimeout(() => {
        resultsContainer.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }
}

// --- UPDATED SCROLL FUNCTIONS ---
async function onApply(newPrefs) {
  prefs.value = newPrefs
  localStorage.setItem(MANUAL_KEY, '1')
  await fetchResults()
  await nextTick()
  
  // Scroll directly to the results container instead of the very top
  if (resultsContainer.value) {
    setTimeout(() => {
      resultsContainer.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }
}

async function onReset() {
  prefs.value = { ...DEFAULT_PREFS, facilities: [] }
  localStorage.setItem(MANUAL_KEY, '1')
  await fetchResults()
  await nextTick()
  
  if (resultsContainer.value) {
    setTimeout(() => {
      resultsContainer.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }
}

async function onResetToPreferences() {
  const user = readStoredUser()
  prefs.value = {
    ...DEFAULT_PREFS,
    facilities: [],
    ...prefsFromUserPreferences(user?.preferences),
  }
  localStorage.removeItem(MANUAL_KEY)
  await fetchResults()
  await nextTick()
  
  if (resultsContainer.value) {
    setTimeout(() => {
      resultsContainer.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }
}

watch(prefs, (v) => {
  const { userLocation, ...toSave } = v
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}, { deep: true })

watch(() => route.query.q, (newQ) => {
  const val = newQ || ''
  if (val !== query.value) {
    query.value = val
    fetchResults()
    nextTick(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }
})

onMounted(async () => {
  prefs.value = initialPrefs()
  fetchWeather()
    .then((w) => (weather.value = w))
    .catch((e) => console.log('Weather unavailable: ' + e.message))
  
  try {
    saved.value = await fetchSavedIds()
  } catch (e) {
    console.error('Could not load saved places', e)
  }

  fetchResults()
})
</script>

<template>
  <div class="x-browse">
  <WeatherBackdrop v-if="showBackdrop" :weather="weather" :preview="previewSky" />

  <!-- TESTING ONLY: switch the weather background. Shown when running locally,
       or on any copy with ?weather=test in the URL; markers never see it. -->
  <div v-if="showWeatherTester" class="x-weather-tester" role="group" aria-label="Weather preview" data-test="weather-tester">
    <span class="x-weather-tester__label">Weather test</span>
    <button v-for="option in WEATHER_PREVIEWS" :key="option.key" type="button"
      :class="{ 'is-active': previewSky === option.key }" :aria-pressed="previewSky === option.key"
      @click="previewSky = option.key">{{ option.label }}</button>
    <button type="button" :class="{ 'is-active': showBackdrop }" :aria-pressed="showBackdrop"
      data-test="toggle-backdrop" @click="showBackdrop = !showBackdrop">Page bg {{ showBackdrop ? 'on' : 'off' }}</button>
  </div>
  <div class="container py-4 x-page x-browse__content">
    <h2 class="mb-1">Find a study spot</h2>
    <p v-if="weatherLine" class="x-weather-line x-mono mb-3" data-test="weather-line">{{ weatherLine }}</p>

    <div class="x-hero__search mb-4">
      <div class="ss-search x-search">
        <HomeSearchBox v-model="query" :places="spaces" @search="search" @select="goToPlace" />
      </div>
    </div>

    <!-- The weather is the page background now (WeatherBackdrop). To bring the
         card back, restore: <WeatherScene :weather="weather" area="Singapore" :compact="true" /> -->

    <div class="row">
      <div class="col-lg-3">
        <SearchFilters :modelValue="prefs" :facilityOptions="facilityOptions" :areaOptions="areaOptions"
          :hasPreferences="hasUserPreferences" @apply="onApply" @reset="onReset"
          @reset-to-preferences="onResetToPreferences" />
      </div>

      <!-- This ref is crucial for the scrolling logic -->
      <div class="col-lg-9" ref="resultsContainer" style="scroll-margin-top: 100px;">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <span data-test="result-count">{{ loading ? 'Loading…' : results.length + ' result(s)' }}</span>
          
          <div class="sort-select-wrapper">
            <CustomSelect v-model="sortBy" :options="sortOptions" data-test="sort-select" />
          </div>
        </div>

        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border"></div>
        </div>
        <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-else-if="results.length === 0" class="alert alert-info" data-test="no-results">
          No study spaces match. Try removing some filters.
        </div>

        <template v-else>
          <div class="row row-cols-3 g-2 g-sm-3 mb-5">
            <div class="col" v-for="space in paginatedResults" :key="space.id">
              <PlaceCard 
                :place="space" 
                :score="space.score" 
                :saved="saved.includes(space.id)" 
                :tags="cardTags(space)"
                @toggle-save="toggleSave" 
              />
            </div>
          </div>
          
          <div v-if="totalPages > 1" class="x-pagination mt-4 mb-5">
            <button class="x-page-btn" :disabled="currentPage === 1" data-test="page-prev" @click="changePage(currentPage - 1)">
              ◀ Prev
            </button>

            <template v-for="(page, index) in visiblePages" :key="index">
              <span v-if="page === '...'" class="x-page-ellipsis">...</span>
              <button 
                v-else
                class="x-page-btn" 
                :class="{ 'is-active': currentPage === page }"
                @click="changePage(page)"
              >
                {{ page }}
              </button>
            </template>

            <button class="x-page-btn" :disabled="currentPage === totalPages" data-test="page-next" @click="changePage(currentPage + 1)">
              Next ▶
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.x-browse { position: relative; }
.x-browse__content { position: relative; z-index: 1; }
.x-weather-line { font-size: .85rem; color: var(--x-muted); }

/* TESTING ONLY: weather background switcher */
.x-weather-tester {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 50;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  max-width: calc(100vw - 120px);
  padding: 6px;
  border: 2px solid var(--x-ink);
  border-radius: 14px;
  background: var(--x-card);
  box-shadow: 3px 3px 0 var(--x-ink);
  font-size: .78rem;
}
.x-weather-tester__label { padding: 0 6px; font-weight: 800; }
.x-weather-tester button {
  padding: 4px 9px;
  border: 1px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-paper);
  color: var(--x-ink);
  font-weight: 700;
}
.x-weather-tester button.is-active { background: var(--x-lime); }

.x-hero__search {
  width: 100%;
  position: relative;
  z-index: 5;
}

.x-search {
  padding: 4px 4px 4px 14px;
  width: 100%;
}

.sort-select-wrapper {
  width: 100%;
  max-width: 180px;
}

/* --- Pagination Styles --- */
.x-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.x-page-btn {
  background: var(--x-card, #fff);
  border: 2px solid var(--x-ink, #111);
  border-radius: 10px;
  padding: 0.4rem 0.8rem;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--x-ink, #111);
  box-shadow: 2px 2px 0 var(--x-ink, #111);
  transition: all 0.2s ease;
  cursor: pointer;
  min-width: 38px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.x-page-btn:not(:disabled):hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--x-ink, #111);
  background-color: var(--x-paper, #f5f5f5);
}

.x-page-btn.is-active {
  background-color: var(--x-lime, #d1f529);
}

.x-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 1px 1px 0 var(--x-ink, #111);
  transform: none;
  background-color: #e0e0e0;
}

.x-page-ellipsis {
  font-weight: 800;
  color: var(--x-ink, #111);
  padding: 0 4px;
  user-select: none;
}

@media (max-width: 575.98px) {
  .x-browse__content h2 { font-size: 1.85rem; }
  .x-weather-line { font-size: .68rem; margin-bottom: .75rem !important; }
  .x-hero__search { margin-bottom: 1rem !important; }
  .x-search { padding: 2px 2px 2px 10px; }

  /* Filters toggle, count and sort scaled to the mini cards */
  .x-browse__content :deep([data-test="filter-toggle"]) {
    --bs-btn-padding-y: .25rem;
    font-size: .85rem;
    box-shadow: 2px 2px 0 var(--x-ink);
  }
  [data-test="result-count"] { font-size: .8rem; }
  .sort-select-wrapper { max-width: 140px; }
  .sort-select-wrapper :deep(.ss-select-trigger) {
    padding: .25rem .6rem;
    border-radius: 10px;
    font-size: .78rem;
    box-shadow: 2px 2px 0 var(--x-ink);
  }

  /* the tester is dev-only; keep it a small strip that clears the chat buttons */
  .x-weather-tester {
    right: 10px;
    bottom: 10px;
    max-width: calc(100vw - 76px);
    gap: 3px;
    padding: 4px;
    border-radius: 12px;
    font-size: .66rem;
  }
  .x-weather-tester__label { display: none; }
  .x-weather-tester button { padding: 2px 7px; }
}
</style>