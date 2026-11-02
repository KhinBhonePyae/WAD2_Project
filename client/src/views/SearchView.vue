<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import HomeSearchBox from '../components/HomeSearchBox.vue'
import SearchFilters from '../components/SearchFilters.vue'
import PlaceCard from '../components/PlaceCard.vue'
import WeatherStrip from '../components/WeatherStrip.vue'
import CustomSelect from '../components/CustomSelect.vue'
import { suitabilityBreakdown } from '../utils/suitability'
import { DEFAULT_PREFS, filterPlaces, prefsFromUserPreferences } from '../utils/searchFilters'
import { BASE_URL } from '../utils/api'
import { fetchWeather } from '../utils/weather'

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
}

function goToPlace(place) {
  router.push(`/places/${place.id}`)
}

const results = computed(() => {
  const scored = spaces.value.map((s) => ({
    ...s,
    ...suitabilityBreakdown(s, prefs.value.facilities, weather.value),
  }))
  const list = filterPlaces(scored, prefs.value)

  if (sortBy.value === 'score') list.sort((a, b) => b.score - a.score)
  else if (sortBy.value === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  else if (sortBy.value === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
  return list
})

function onApply(newPrefs) {
  prefs.value = newPrefs
  localStorage.setItem(MANUAL_KEY, '1')
  fetchResults()
}

function onReset() {
  prefs.value = { ...DEFAULT_PREFS, facilities: [] }
  localStorage.setItem(MANUAL_KEY, '1')
  fetchResults()
}

function onResetToPreferences() {
  const user = readStoredUser()
  prefs.value = {
    ...DEFAULT_PREFS,
    facilities: [],
    ...prefsFromUserPreferences(user?.preferences),
  }
  localStorage.removeItem(MANUAL_KEY)
  fetchResults()
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
  }
})

onMounted(() => {
  prefs.value = initialPrefs()
  fetchWeather()
    .then((w) => (weather.value = w))
    .catch((e) => console.log('Weather unavailable: ' + e.message))
  fetchResults()
})
</script>

<template>
  <div class="container py-4 x-page">
    <h2 class="mb-3">Find a study spot</h2>

    <WeatherStrip :weather="weather" area="Singapore" class="mb-3" />
    
    <div class="x-hero__search mb-4">
      <div class="ss-search x-search">
        <HomeSearchBox v-model="query" :places="spaces" @search="search" @select="goToPlace" />
      </div>
    </div>

    <div class="row">
      <div class="col-lg-3">
        <SearchFilters :modelValue="prefs" :facilityOptions="facilityOptions" :areaOptions="areaOptions"
          :hasPreferences="hasUserPreferences" @apply="onApply" @reset="onReset"
          @reset-to-preferences="onResetToPreferences" />
      </div>

      <div class="col-lg-9">
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

        <div v-else class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          <div class="col" v-for="space in results" :key="space.id">
            <PlaceCard :place="space" :score="space.score" :saved="false" />
          </div>
        </div>
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

@media (max-width: 576px) {
  .sort-select-wrapper {
    max-width: 100%;
  }
}
</style>