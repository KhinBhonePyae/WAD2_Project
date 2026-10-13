<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { suitabilityScore } from '../utils/suitability.js'
import { fetchWeather } from '../utils/weather.js'
import { fetchSavedIds, toggleSavedId, isLoggedIn } from '../utils/saved.js'
import PlaceCard from '../components/PlaceCard.vue'
import WeatherScene from '../components/WeatherScene.vue'
import HomeSearchBox from '../components/HomeSearchBox.vue'

const router = useRouter()
const places = ref([])
const weather = ref(null)
const saved = ref([])
const loading = ref(true)
const q = ref('')

const FACILITIES = ['wifi', 'sockets']   // the home page assumes the common case

const topPicks = computed(() => {
  return places.value
    .map(p => ({ place: p, score: suitabilityScore(p, FACILITIES, weather.value) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
})

function search() {
  router.push({ path: '/places', query: q.value ? { q: q.value } : {} })
}

function goToPlace(place) {
  router.push(`/places/${place.id}`)
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

onMounted(async () => {
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
})
</script>

<template>
  <header class="ss-hero" :class="{ 'ss-hero--night': weather && !weather.isDay }">
    <div class="container">
      <div class="ss-rise">
        <span class="ss-badge ss-badge--purple mb-3">Built for students in Singapore</span>
        <h1 class="mb-3">Find a study spot that suits you!</h1>
        <p class="mb-4">
          Find your new favourite study spots! Including Libraries, cafés and campus corners...
        </p>
      </div>

      <div class="ss-search ss-rise" style="max-width:640px">
        <HomeSearchBox v-model="q" :places="places" @search="search" @select="goToPlace" />
      </div>


      <!-- Not wrapped in .ss-rise: its transform would stop the scene filling the hero -->
      <WeatherScene :weather="weather" variant="hero" />
    </div>
  </header>

  <main class="container">
    <section class="ss-section">
      <div class="ss-section__head">
        <div>
          <h2 class="mb-1">Top picks right now</h2>
          <p class="ss-muted mb-0">Scored on Wi-Fi, sockets available, and how busy each place is.</p>
        </div>
        <RouterLink to="/places" class="btn btn-outline-primary btn-sm">Browse all</RouterLink>
      </div>

      <div v-if="loading" class="row g-3">
        <div v-for="n in 3" :key="n" class="col-12 col-md-6 col-lg-4">
          <div class="ss-card">
            <div class="ss-card__media ss-skeleton"></div>
            <div class="ss-card__body">
              <div class="ss-skeleton" style="height:22px;width:70%"></div>
              <div class="ss-skeleton" style="height:14px;width:45%"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="row g-3">
        <div v-for="item in topPicks" :key="item.place.id" class="col-12 col-md-6 col-lg-4 ss-rise">
          <PlaceCard :place="item.place" :score="item.score" :saved="saved.includes(item.place.id)"
            @toggle-save="toggleSave" />
        </div>
      </div>
    </section>

    <section class="ss-section pt-0">
      <div class="ss-card p-4 p-md-5"
        style="background:linear-gradient(135deg,var(--ss-purple-100),var(--ss-sky-100));border-color:var(--ss-purple-200)">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h2 class="mb-2">Not sure what you need?</h2>
            <p class="ss-muted mb-0" style="max-width:48ch">
              Describe it in plain English — “quiet place near SMU for four people this afternoon”
              — and the assistant picks from our catalogue.
            </p>
          </div>
          <button class="btn btn-accent" disabled title="Coming in a later sprint">
            Ask the assistant
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* Keep the headline and search above the weather scene */
.ss-hero{
  z-index: 100;
  overflow: visible;
}

.ss-rise {
  position: relative;
  z-index: 2;
}

/* Night skies are dark across the whole hero on wide screens, so use light text there */
@media (min-width: 768px) {

  .ss-hero--night h1,
  .ss-hero--night p {
    color: var(--ss-text-invert);
  }
}
</style>
