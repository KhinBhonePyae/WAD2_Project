<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { Carousel } from 'bootstrap'
import { useRoute, RouterLink } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { suitabilityScore } from '../utils/suitability.js'
import { fetchWeather } from '../utils/weather.js'
import SuitabilityScore from '../components/SuitabilityScore.vue'
import CrowdMeter from '../components/CrowdMeter.vue'
import StarRating from '../components/StarRating.vue'
import WeatherStrip from '../components/WeatherStrip.vue'
import ReviewForm from '../components/ReviewForm.vue'
import ReviewList from '../components/ReviewList.vue'

const route = useRoute()
const carouselRef = ref(null)
const place = ref(null)
const reviews = ref([])
const summary = ref({ rating: 0, reviewCount: 0, crowdLevel: null })
const weather = ref(null)
const loading = ref(true)
const busy = ref(false)
const notFound = ref(false)

const FACILITY_LABELS = { wifi: 'Wi-Fi', sockets: 'Power sockets', fnb: 'Food & drink',
                          water: 'Water point', toilets: 'Toilets', quiet: 'Quiet zone' }

const score = computed(() =>
  place.value ? suitabilityScore({ ...place.value, crowdLevel: summary.value.crowdLevel },
                                 ['wifi', 'sockets'], weather.value) : 0)

const art = computed(() => 'linear-gradient(135deg,#9DD1F6,#C4AAE9)')

async function loadReviews(id) {
  const { data } = await axios.get(`${BASE_URL}/reviews/place/${id}`)
  reviews.value = data.reviews
  summary.value = data.summary
}

async function addReview(payload) {
  busy.value = true
  try {
    await axios.post(`${BASE_URL}/reviews`, payload)
    await loadReviews(route.params.id)
  } catch (e) {
    console.error('Could not post review', e)
  } finally { busy.value = false }
}
async function editReview({ id, rating, comment }) {
  try {
    await axios.put(`${BASE_URL}/reviews/${id}`, { rating, comment })
    await loadReviews(route.params.id)
  } catch (e) { console.error('Could not edit review', e) }
}
async function deleteReview(id) {
  try {
    await axios.delete(`${BASE_URL}/reviews/${id}`, { params: { placeId: route.params.id } })
    await loadReviews(route.params.id)
  } catch (e) { console.error('Could not delete review', e) }
}

onMounted(async () => {
  const id = route.params.id
  try {
    const { data } = await axios.get(`${BASE_URL}/places/${id}`)
    place.value = data
    const [, w] = await Promise.all([loadReviews(id), fetchWeather(data.lat, data.lon).catch(() => null)])
    weather.value = w
  } catch (e) {
    notFound.value = true
  } finally { loading.value = false }
  await nextTick()

  if (carouselRef.value && place.value?.photos?.length > 1) {
    const carousel = new Carousel(carouselRef.value, {
      interval: 4000,
      pause: false,
      wrap: true
    })
    carousel.cycle()
  }
})
</script>

<template>
  <main class="container ss-section">
    <div v-if="loading" class="ss-card" style="height:320px"></div>

    <div v-else-if="notFound" class="ss-empty">
      <p class="mb-3">We couldn't find that study space.</p>
      <RouterLink to="/places" class="btn btn-outline-primary btn-sm">Back to all spots</RouterLink>
    </div>

    <template v-else>
      <RouterLink to="/places" class="ss-meta text-decoration-none d-inline-block mb-3">← All spots</RouterLink>

      <!-- Photo carousel placeholder: Places API photos slot in here -->
      <div v-if="place.photos?.length" id="placeCarousel" ref="carouselRef"
        class="carousel slide ss-card mb-4 overflow-hidden">

      <div v-if="place.photos.length > 1" class="carousel-indicators">
        <button v-for="(photo, index) in place.photos" :key="'indicator-' + index"
                type="button" data-bs-target="#placeCarousel" :data-bs-slide-to="index"
                :class="{ active: index === 0 }" :aria-current="index === 0 ? 'true' : undefined"
                :aria-label="'Slide ' + (index + 1)"></button>
      </div>

      <div class="carousel-inner">
        <div v-for="(photo, index) in place.photos" :key="photo"
            class="carousel-item" :class="{ active: index === 0 }">
          <img :src="photo" :alt="`${place.name} photo ${index + 1}`"
              class="d-block w-100 place-carousel-image">
        </div>
      </div>

      <button v-if="place.photos.length > 1" class="carousel-control-prev" type="button"
              data-bs-target="#placeCarousel" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      </button>

      <button v-if="place.photos.length > 1" class="carousel-control-next" type="button"
              data-bs-target="#placeCarousel" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      </button>
    </div>

    <div v-else class="ss-card mb-4">
      <div class="ss-card__media" :style="{ background: art, aspectRatio: '21/8' }"></div>
    </div>

      <div class="row g-4">
        <div class="col-12 col-lg-7">
          <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div>
              <h1 class="mb-1" data-test="place-name">{{ place.name }}</h1>
              <p class="ss-muted mb-2">{{ place.address }}</p>
              <div class="d-flex align-items-center gap-3 flex-wrap">
                <StarRating :value="summary.rating || place.rating" :count="summary.reviewCount" />
                <CrowdMeter :level="summary.crowdLevel" />
              </div>
            </div>
            <div class="text-center">
              <SuitabilityScore :score="score" />
              <div class="ss-meta mt-1">Suitability</div>
            </div>
          </div>

          <p class="mt-3">{{ place.description }}</p>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <span class="ss-badge" :class="place.openNow ? 'ss-badge--green' : 'ss-badge--pink'">
              {{ place.openNow ? '● Open now' : 'Closed' }}
            </span>
            <span class="ss-badge ss-badge--neutral">{{ place.indoor ? 'Indoor' : 'Outdoor' }}</span>
            <span class="ss-badge ss-badge--neutral">{{ place.hours }}</span>
          </div>

          <h2 class="h5 mt-4 mb-2">Facilities</h2>
          <div class="d-flex flex-wrap gap-2">
            <span v-for="f in place.facilities" :key="f" class="ss-badge ss-badge--sky">
              {{ FACILITY_LABELS[f] || f }}
            </span>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <WeatherStrip :weather="weather" :area="place.area" class="mb-3" />
          <div class="ss-card p-4">
            <h2 class="h6 mb-2">Why this score?</h2>
            <ul class="ss-meta mb-0" style="padding-left:1.1rem;line-height:1.9">
              <li>Facilities matched against Wi-Fi and power sockets</li>
              <li>{{ place.openNow ? 'Open right now' : 'Currently closed' }}</li>
              <li>Crowd level from the latest student report</li>
              <li v-if="!place.indoor">Outdoor — adjusted for current weather</li>
            </ul>
          </div>
          <!-- Map goes here: Leong Yew Kai's area -->
          <div class="ss-card p-4 mt-3 text-center ss-muted" style="border-style:dashed">
            Map view — to be added
          </div>
        </div>
      </div>

      <section class="mt-5">
        <h2 class="mb-3">Reviews &amp; crowd reports</h2>
        <div class="row g-4">
          <div class="col-12 col-lg-5">
            <ReviewForm :place-id="Number(place.id)" :busy="busy" @submit-review="addReview" />
          </div>
          <div class="col-12 col-lg-7">
            <ReviewList :reviews="reviews" @edit-review="editReview" @delete-review="deleteReview" />
          </div>
        </div>
      </section>
    </template>
  </main>
</template>
