<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import HomeSearchBox from '../components/HomeSearchBox.vue'
import SearchFilters from '../components/SearchFilters.vue'
import PlaceCard from '../components/PlaceCard.vue'
import WeatherScene from '../components/WeatherScene.vue'
import CustomSelect from '../components/CustomSelect.vue'
import { suitabilityBreakdown } from '../utils/suitability'
import { DEFAULT_PREFS, filterPlaces, prefsFromUserPreferences, sortByDistance } from '../utils/searchFilters'
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

function initialPrefs() {
  if (localStorage.getItem(MANUAL_KEY) === '1') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return { ...DEFAULT_PREFS, facilities: [], ...JSON.parse(saved) } }
      catch { /* corrupt entry — fall through to preferences */ }
    }
  }
  const user = readStoredUser()
  return { ...DEFAULT_PREFS, facilities: [], ...prefsFromUserPreferences(user?.preferences) }
}

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

const results = computed(() => {
  const scored = spaces.value.map((s) => ({
    ...s,
    ...suitabilityBreakdown(s, prefs.value.facilities, weather.value),
  }))
  
  let list = filterPlaces(scored, prefs.value)

  if (prefs.value.nearbyOnly && prefs.value.userLocation) {
    list = sortByDistance(list, prefs.value.userLocation)
  } else {
    if (sortBy.value === 'score') list.sort((a, b) => b.score - a.score)
    else if (sortBy.value === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    else if (sortBy.value === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  return list
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

async function onApply(newPrefs) {
  prefs.value = newPrefs
  localStorage.setItem(MANUAL_KEY, '1')
  await fetchResults()
  await nextTick()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function onReset() {
  prefs.value = { ...DEFAULT_PREFS, facilities: [] }
  localStorage.setItem(MANUAL_KEY, '1')
  await fetchResults()
  await nextTick()
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
  <div class="container py-4 x-page">
    <h2 class="mb-3">Find a study spot</h2>

    <div class="x-hero__search mb-4">
      <div class="ss-search x-search">
        <HomeSearchBox v-model="query" :places="spaces" @search="search" @select="goToPlace" />
      </div>
    </div>

    <!-- Wrapper that forces the mockup layout -->
    <div class="mb-4">
  <WeatherScene :weather="weather" area="Singapore" :compact="true" />
    </div>

    <div class="row">
      <div class="col-lg-3">
        <SearchFilters :modelValue="prefs" :facilityOptions="facilityOptions" :areaOptions="areaOptions"
          :hasPreferences="hasUserPreferences" @apply="onApply" @reset="onReset"
          @reset-to-preferences="onResetToPreferences" />
      </div>

      <div class="col-lg-9" ref="resultsContainer" style="scroll-margin-top: 100px;">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <span data-test="result-count">{{ results.length }} result(s)</span>
          
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
          <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3 mb-5">
            <div class="col" v-for="space in paginatedResults" :key="space.id">
              <PlaceCard 
                :place="space" 
                :score="space.score" 
                :saved="saved.includes(space.id)" 
                @toggle-save="toggleSave" 
              />
            </div>
          </div>
          
          <div v-if="totalPages > 1" class="x-pagination mt-4 mb-5">
            <button class="x-page-btn" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">
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

            <button class="x-page-btn" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">
              Next ▶
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

/* =========================================
   WEATHER SCENE MOCKUP OVERRIDES
   ========================================= */

/* --- Sun/Moon (Top Left) --- */
.weather-wrapper :deep(.ws-sun) {
  left: 10% !important;
  right: auto !important;
  top: 10% !important;
  width: 100px !important;
  height: 100px !important;
}

/* --- Temperature Card (Bottom Left - Matches screenshot exactly) --- */
.weather-wrapper :deep(.ws-card) {
  left: 20px !important;
  right: auto !important;
  bottom: 20px !important;
  padding: 12px 20px 12px 16px !important;
  border: 2px solid var(--x-ink, #111) !important;
  box-shadow: 3px 3px 0 var(--x-ink, #111) !important; /* Thicker shadow */
  background: var(--x-card, #fff) !important;
  border-radius: 14px !important; /* Tighter corners matching screenshot */
  max-width: calc(100% - 160px) !important; 
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}

.weather-wrapper :deep(.ws-card__temp) {
  font-size: 2.8rem !important;
  line-height: 0.9 !important;
  letter-spacing: -0.04em !important;
}
.weather-wrapper :deep(.ws-card__temp sup) {
  font-size: 1rem !important;
  top: -1.5em !important;
}
.weather-wrapper :deep(.ws-card__label) {
  font-size: 1rem !important;
  font-weight: 800 !important; /* Thick bold text */
}
.weather-wrapper :deep(.ws-card__advice) {
  font-size: 0.85rem !important;
  margin-top: 2px !important;
}

/* --- Interactive Dial (Bottom Right) --- */
.weather-wrapper :deep(.ws-dial-wrap) {
  right: 20px !important;
  left: auto !important;
  bottom: 20px !important;
  top: auto !important;
  transform: scale(0.85) !important;
  transform-origin: bottom right !important;
}

/* =========================================
   OVERRIDE THE COMPONENT'S INTERNAL MOBILE MEDIA QUERIES
   ========================================= */
@media (max-width: 575.98px) {
  .weather-wrapper {
    height: 240px !important;
  }
  .weather-wrapper :deep(.ws-card) {
    left: 16px !important;
    right: auto !important;
    bottom: 16px !important;
    max-width: calc(100% - 130px) !important;
    padding: 10px 14px !important;
  }
  .weather-wrapper :deep(.ws-card__temp) {
    font-size: 2.2rem !important;
  }
  .weather-wrapper :deep(.ws-dial-wrap) {
    right: 16px !important;
    left: auto !important;
    bottom: 16px !important;
    top: auto !important;
    transform: translateX(0) scale(0.75) !important; 
    transform-origin: bottom right !important;
  }
}

/* =========================================
   PAGINATION STYLES
   ========================================= */
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

@media (max-width: 576px) {
  .sort-select-wrapper {
    max-width: 100%;
  }
}
</style>