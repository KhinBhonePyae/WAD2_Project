<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import SearchQueryBar from '../components/SearchQueryBar.vue'
import SearchFilters from '../components/SearchFilters.vue'
import PlaceCard from '../components/PlaceCard.vue'
import WeatherStrip from '../components/WeatherStrip.vue'
import { suitabilityBreakdown } from '../utils/suitability'
import { DEFAULT_PREFS, filterPlaces, prefsFromUserPreferences } from '../utils/searchFilters'
import { BASE_URL } from '../utils/api'
import { fetchWeather } from '../utils/weather'

const MANUAL_KEY = 'studyspot_search_prefs_manual'
const STORAGE_KEY = 'studyspot_search_prefs'

const query = ref('')
const prefs = ref({ ...DEFAULT_PREFS, facilities: [] })
const sortBy = ref('score')
const spaces = ref([])
const facilityOptions = ref([])
const areaOptions = ref([])
const loading = ref(false)
const error = ref('')
const weather = ref(null)

const USER_KEY = 'user' // matches the key CatalogueView reads

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') }
  catch { return null }
}

function initialPrefs() {
  // A manual filter choice always wins — the user set it deliberately.
  if (localStorage.getItem(MANUAL_KEY) === '1') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return { ...DEFAULT_PREFS, facilities: [], ...JSON.parse(saved) } }
      catch { /* corrupt entry — fall through to preferences */ }
    }
  }

  // No manual state yet → seed from profile preferences.
  const user = readStoredUser()
  return { ...DEFAULT_PREFS, facilities: [], ...prefsFromUserPreferences(user?.preferences) }
}

// True when the current user has anything we can auto-select from.
// Drives the visibility of "Reset to my preferences".
const hasUserPreferences = computed(() => {
  const p = readStoredUser()?.preferences
  return !!p && !!(p.wifiRequired || p.socketsRequired || p.quietPreferred || p.indoorPreferred)
})

async function search() {
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

// Score with the shared formula, apply client-side filters, then sort.
// Recomputes automatically when the weather arrives or the prefs change.
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
  search()
}

function onReset() {
  prefs.value = { ...DEFAULT_PREFS, facilities: [] }
  localStorage.setItem(MANUAL_KEY, '1')
  search()
}

function onResetToPreferences() {
  const user = readStoredUser()
  prefs.value = {
    ...DEFAULT_PREFS,
    facilities: [],
    ...prefsFromUserPreferences(user?.preferences),
  }
  localStorage.removeItem(MANUAL_KEY)
  search()
}

// Persist preferences (Week 6: localStorage + JSON)
watch(prefs, (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true })

onMounted(() => {
  prefs.value = initialPrefs()
  fetchWeather()
    .then((w) => (weather.value = w))
    .catch((e) => console.log('Weather unavailable: ' + e.message))
  search()
})

</script>

<template>
  <div class="container py-4 x-page">
    <h2 class="mb-3">Find a study spot</h2>

    <WeatherStrip :weather="weather" area="Singapore" class="mb-3" />
    <SearchQueryBar v-model="query" @search="search" />

    <div class="row">
      <div class="col-lg-3">
        <SearchFilters :modelValue="prefs" :facilityOptions="facilityOptions" :areaOptions="areaOptions"
          :hasPreferences="hasUserPreferences" @apply="onApply" @reset="onReset"
          @reset-to-preferences="onResetToPreferences" />
      </div>

      <div class="col-lg-9">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span data-test="result-count">{{ results.length }} result(s)</span>
          <select class="form-select w-auto" v-model="sortBy" data-test="sort-select">
            <option value="score">Best match</option>
            <option value="rating">Highest rated</option>
            <option value="name">Name (A–Z)</option>
          </select>
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
            <ul class="list-unstyled ss-meta mt-2 mb-0" data-test="score-reasons">
              <li v-for="r in space.reasons" :key="r">• {{ r }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>