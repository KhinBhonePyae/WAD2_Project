<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Carousel } from 'bootstrap'
import { useRoute, RouterLink } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { suitabilityBreakdown, preferencesToWanted, FACILITY_LABELS, ENTRY_LABELS, closureStatusOf } from '../utils/suitability.js'
import { fetchWeather } from '../utils/weather.js'
import SuitabilityScore from '../components/SuitabilityScore.vue'
import CrowdMeter from '../components/CrowdMeter.vue'
import StarRating from '../components/StarRating.vue'
import { gsap, reducedMotion } from '../utils/motion.js'
import ReviewForm from '../components/ReviewForm.vue'
import ReviewList from '../components/ReviewList.vue'
import CrowdHistogram from '../components/CrowdHistogram.vue'
import IntentPanel from '../components/IntentPanel.vue'
import PlaceMap from '../components/PlaceMap.vue'
import ReportIssue from '../components/ReportIssue.vue'

const route = useRoute()
const carouselRef = ref(null)
const reviewsScrollRef = ref(null)
const place = ref(null)
const reviews = ref([])
const crowdRef = ref(null)
const summary = ref({ rating:0, reviewCount:0, crowdLevel:null })
const weather = ref(null)
const loading = ref(true)
const busy = ref(false)
const reviewError = ref('')
const reviewFormKey = ref(0)
const reviewModalOpen = ref(false)
const notFound = ref(false)
let ctx = null

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') }
  catch { return null }
}

const currentUser = ref(readStoredUser())
const profileWanted = computed(() => preferencesToWanted(currentUser.value?.preferences))
const isPersonalized = computed(() => !!currentUser.value && profileWanted.value.length > 0)
const closureStatus = computed(() => closureStatusOf(place.value || {}))

function syncUser() {
  currentUser.value = readStoredUser()
}

const scoreInfo = computed(() => {
  if (!place.value || !currentUser.value) return { score:0, reasons:[] }
  return suitabilityBreakdown(place.value, profileWanted.value, weather.value)
})

const score = computed(() => scoreInfo.value.score)

const preferenceMatches = computed(() => {
  if (!place.value || !isPersonalized.value) return []
  const facilities = place.value.facilities || []

  return [
    { key:'wifi', label:'Wi-Fi', active:currentUser.value?.preferences?.wifiRequired, matched:facilities.includes('wifi') },
    { key:'sockets', label:'Power sockets', active:currentUser.value?.preferences?.socketsRequired, matched:facilities.includes('sockets') },
    { key:'quiet', label:'Quiet environment', active:currentUser.value?.preferences?.quietPreferred, matched:facilities.includes('quiet') },
    { key:'indoor', label:'Indoor location', active:currentUser.value?.preferences?.indoorPreferred, matched:!!place.value.indoor }
  ].filter(item => item.active)
})

const art = computed(() => 'linear-gradient(135deg,#9DD1F6,#C4AAE9)')

function availabilityLabel() {
  if (closureStatus.value === 'temporary') return 'Temporarily closed'
  if (closureStatus.value === 'permanent') return 'Permanently closed'
  return place.value?.openNow ? '● Open now' : 'Closed now'
}

function authHeader() {
  return { headers:{ Authorization:`Bearer ${localStorage.getItem('token')}` } }
}

function openReviewModal() {
  reviewError.value = ''
  reviewModalOpen.value = true
}

function closeReviewModal() {
  if (busy.value) return
  reviewError.value = ''
  reviewModalOpen.value = false
}

async function refreshPlaceScoreData() {
  if (!place.value) return

  try {
    const { data } = await axios.get(`${BASE_URL}/places/${route.params.id}`)
    place.value = { ...place.value, ...data }
  } catch (e) {
    console.error('Could not refresh study-space data', e)
  }
}

async function loadReviews(id) {
  const { data } = await axios.get(`${BASE_URL}/reviews/place/${id}`)
  reviews.value = data.reviews
  summary.value = data.summary
  crowdRef.value?.reload()

  if (place.value) {
    place.value = {
      ...place.value,
      crowdLevel:data.summary.crowdLevel,
      rating:data.summary.rating,
      reviewCount:data.summary.reviewCount
    }
  }
}

function onCrowdReported(level) {
  if (level) place.value = { ...place.value, crowdLevel:level }
  else loadReviews(route.params.id)
}

function explainReviewError(e, action) {
  if (e.response?.status === 401) return 'Your login has expired. Please log in again to ' + action + '.'
  return e.response?.data?.error || 'Could not ' + action + '. Please try again.'
}

async function addReview(payload) {
  busy.value = true
  reviewError.value = ''

  try {
    await axios.post(`${BASE_URL}/reviews`, payload, authHeader())
    reviewFormKey.value++
    await loadReviews(route.params.id)
    reviewModalOpen.value = false
  } catch (e) {
    console.error('Could not post review', e)
    reviewError.value = explainReviewError(e, 'post your review')
  } finally {
    busy.value = false
  }
}

async function editReview({ id, rating, comment, crowdLevel }) {
  reviewError.value = ''

  try {
    await axios.put(`${BASE_URL}/reviews/${id}`, { rating, comment, crowdLevel }, authHeader())
    await loadReviews(route.params.id)
  } catch (e) {
    console.error('Could not edit review', e)
    reviewError.value = explainReviewError(e, 'save your changes')
  }
}

async function deleteReview(id) {
  reviewError.value = ''

  try {
    await axios.delete(`${BASE_URL}/reviews/${id}`, authHeader())
    await loadReviews(route.params.id)
  } catch (e) {
    console.error('Could not delete review', e)
    reviewError.value = explainReviewError(e, 'delete your review')
  }
}

function scrollReviews(event) {
  const el = reviewsScrollRef.value
  if (!el) return

  const atTop = el.scrollTop <= 0
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1

  if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) return

  event.preventDefault()
  event.stopPropagation()
  el.scrollTop += event.deltaY
}

onMounted(async () => {
  window.addEventListener('user-login', syncUser)
  const id = route.params.id

  try {
    const { data } = await axios.get(`${BASE_URL}/places/${id}`)
    place.value = data

    const [, w] = await Promise.all([
      loadReviews(id),
      fetchWeather().catch(() => null)
    ])

    weather.value = w
  } catch (e) {
    console.error('Could not load study space', e)
    notFound.value = true
  } finally {
    loading.value = false
  }

  await nextTick()

  if (carouselRef.value && place.value?.photos?.length > 1) {
    const carousel = new Carousel(carouselRef.value, { interval:4000, pause:false, wrap:true })
    carousel.cycle()
  }

  if (!reducedMotion && place.value) {
    ctx = gsap.context(() => {
      gsap.from('.x-detail-title .x-char', {
        yPercent:100, rotation:() => gsap.utils.random(-12,12), autoAlpha:0,
        duration:.9, ease:'expo.out', stagger:.025
      })

      gsap.from('.x-detail-head .ss-score, .x-detail-head .ss-badge', {
        scale:0, rotation:-30, duration:.7, ease:'back.out(2)', stagger:.08, delay:.3
      })

      if (carouselRef.value) {
        gsap.to(carouselRef.value.querySelectorAll('img'), {
          yPercent:12, ease:'none',
          scrollTrigger:{ trigger:carouselRef.value, start:'top top', end:'bottom top', scrub:true }
        })
      }
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('user-login', syncUser)
  ctx?.revert()
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

      <div v-if="place.photos?.length" id="placeCarousel" ref="carouselRef" class="carousel slide ss-card mb-4 overflow-hidden">
        <div v-if="place.photos.length > 1" class="carousel-indicators">
          <button v-for="(photo,index) in place.photos" :key="'indicator-'+index" type="button" data-bs-target="#placeCarousel" :data-bs-slide-to="index" :class="{ active:index===0 }" :aria-current="index===0?'true':undefined" :aria-label="'Slide '+(index+1)"></button>
        </div>

        <div class="carousel-inner">
          <div v-for="(photo,index) in place.photos" :key="photo" class="carousel-item" :class="{ active:index===0 }">
            <img :src="photo" :alt="`${place.name} photo ${index+1}`" class="d-block w-100 place-carousel-image">
          </div>
        </div>

        <button v-if="place.photos.length > 1" class="carousel-control-prev" type="button" data-bs-target="#placeCarousel" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Previous</span>
        </button>

        <button v-if="place.photos.length > 1" class="carousel-control-next" type="button" data-bs-target="#placeCarousel" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>
      </div>

      <div v-else class="ss-card mb-4">
        <div class="ss-card__media" :style="{ background:art, aspectRatio:'21/8' }"></div>
      </div>

      <p v-if="place.photoAttributions?.length" class="ss-meta mt-n3 mb-4">
        Photos: {{ place.photoAttributions.join(', ') }} via Google
      </p>

      <div class="row g-4 x-detail-head">
        <div class="col-12" :class="{ 'col-lg-7':isPersonalized && profileWanted.length }">
          <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div>
              <h1 class="mb-1 x-detail-title" data-test="place-name" :aria-label="place.name">
                <template v-for="(w,wi) in place.name.split(' ')" :key="wi">
                  <span class="x-wordbox" aria-hidden="true">
                    <span v-for="(c,ci) in w.split('')" :key="ci" class="x-char">{{ c }}</span>
                  </span>{{ wi < place.name.split(' ').length-1 ? ' ' : '' }}
                </template>
              </h1>

              <p class="ss-muted mb-2">{{ place.address }}</p>

              <div class="d-flex align-items-center gap-3 flex-wrap">
                <StarRating :value="place.rating" :count="place.reviewCount" />
                <span v-if="place.googleRating" class="ss-meta" data-test="google-rating">
                  Google {{ place.googleRating.toFixed(1) }} ★ ({{ place.googleRatingCount }})
                </span>
                <CrowdMeter :level="place.crowdLevel" />
              </div>
            </div>
          </div>

          <p class="mt-3">{{ place.description }}</p>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <span class="ss-badge" :class="place.openNow && closureStatus === 'normal' ? 'ss-badge--green' : 'ss-badge--pink'">
              {{ availabilityLabel() }}
            </span>

            <span class="ss-badge ss-badge--neutral">
              {{ place.indoor ? 'Indoor' : 'Outdoor' }}
            </span>

            <span v-if="closureStatus === 'normal' && place.hours" class="ss-badge ss-badge--neutral">
              {{ place.hours }}
            </span>

            <span v-if="ENTRY_LABELS[place.entry]" class="ss-badge" :class="place.entry === 'free' ? 'ss-badge--green' : 'ss-badge--neutral'" data-test="entry-badge">
              {{ ENTRY_LABELS[place.entry] }}
            </span>
          </div>

          <details v-if="place.weekdayHours?.length" class="mb-3">
            <summary class="ss-meta">Opening hours this week</summary>
            <ul class="list-unstyled ss-meta mt-2 mb-0">
              <li v-for="line in place.weekdayHours" :key="line">{{ line }}</li>
            </ul>
          </details>

          <div v-if="place.googleMapsUri || place.website" class="d-flex gap-3 mb-3">
            <a v-if="place.googleMapsUri" :href="place.googleMapsUri" target="_blank" rel="noopener" class="ss-meta">Open in Google Maps ↗</a>
            <a v-if="place.website" :href="place.website" target="_blank" rel="noopener" class="ss-meta">Website ↗</a>
          </div>

          <h2 class="h5 mt-4 mb-2">Facilities</h2>

          <div class="d-flex flex-wrap gap-2">
            <span v-for="f in place.facilities" :key="f" class="ss-badge ss-badge--sky">
              {{ FACILITY_LABELS[f] || f }}
            </span>
          </div>
        </div>

        <div v-if="isPersonalized && profileWanted.length" class="col-12 col-lg-5">
          <div class="ss-card h-auto p-4">
            <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-3">
              <h2 class="h6 mb-0">Why this matches you</h2>

              <div class="text-center ss-score--compact">
                <SuitabilityScore :score="score" />
                <div class="ss-meta mt-1">Your match</div>
              </div>
            </div>

            <div class="mb-3">
              <div class="ss-meta fw-bold mb-2">Your study preferences</div>

              <div class="d-flex flex-wrap gap-2">
                <span v-for="item in preferenceMatches" :key="item.key" class="ss-badge" :class="item.matched ? 'ss-badge--green' : 'ss-badge--pink'">
                  {{ item.matched ? '✓' : '✕' }} {{ item.label }}
                </span>
              </div>
            </div>

            <RouterLink to="/profile?edit=1" class="btn btn-outline-primary btn-sm mt-3">
              Edit preferences
            </RouterLink>
          </div>
        </div>

        <div class="col-12 report-right">
          <ReportIssue :place="place" />
        </div>
      </div>

      <IntentPanel :place="place" class="mt-4" @changed="refreshPlaceScoreData" />

      <!-- REVIEWS + CROWD -->
      <section class="mt-5 reviews-section">
        <h2 class="mb-3">Reviews &amp; crowd reports</h2>

        <CrowdHistogram ref="crowdRef" :place="place" class="mb-4" @reported="onCrowdReported" />

        <!-- This replaces the old Google Reviews area -->
        <div class="community-reviews">
          <div class="community-reviews-header">
            <div>
              <h3 class="mb-1">Community reviews</h3>
              <p class="ss-muted mb-0">See what LockedIN users think about this study space.</p>
            </div>

            <button v-if="currentUser" type="button" class="btn btn-primary review-button" @click="openReviewModal">
              ★ Leave a review
            </button>

            <RouterLink v-else to="/login" class="btn btn-primary review-button">
              Log in to review
            </RouterLink>
          </div>

          <div ref="reviewsScrollRef" class="reviews-scroll" @wheel="scrollReviews">
            <ReviewList :reviews="reviews" :current-user-id="currentUser?._id" @edit-review="editReview" @delete-review="deleteReview" />
          </div>
        </div>
      </section>

      <div class="map-section">
        <PlaceMap :place="place" />
      </div>

      <!-- LEAVE REVIEW POPUP -->
      <div v-if="reviewModalOpen" class="review-modal-overlay" @click.self="closeReviewModal">
        <div class="review-modal">
          <div class="review-modal-header">
            <div>
              <div class="review-modal-eyebrow">COMMUNITY REVIEW</div>
              <h2 class="mb-1">Leave a review</h2>
              <p class="ss-muted mb-0">{{ place.name }}</p>
            </div>

            <button type="button" class="review-modal-close" :disabled="busy" aria-label="Close" @click="closeReviewModal">
              ×
            </button>
          </div>

          <div v-if="reviewError" class="alert alert-danger py-2 mb-3" role="alert" data-test="review-error">
            {{ reviewError }}
          </div>

          <ReviewForm :key="reviewFormKey" :place-id="Number(place.id)" :busy="busy" :author-name="currentUser.name" @submit-review="addReview" />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.reviews-section {
  margin-bottom:3rem;
}

.community-reviews {
  padding:1.4rem;
  border:2px solid var(--x-ink);
  border-radius:22px;
  background:white;
  box-shadow:6px 6px 0 var(--x-ink);
}

.community-reviews-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:1rem;
  margin-bottom:1.3rem;
}

.review-button {
  flex-shrink:0;
}

.reviews-scroll {
  height:430px;
  overflow-y:auto;
  overflow-x:hidden;
  padding-right:.7rem;
  padding-bottom:.25rem;
  scrollbar-gutter:stable;
  overscroll-behavior-y:contain;
  touch-action:pan-y;
}

.reviews-scroll::-webkit-scrollbar {
  width:8px;
}

.reviews-scroll::-webkit-scrollbar-track {
  background:transparent;
}

.reviews-scroll::-webkit-scrollbar-thumb {
  background:var(--x-lilac);
  border:1px solid var(--x-ink);
  border-radius:999px;
}

.report-right {
  display:flex;
  justify-content:flex-end;
  width:100%;
}

.map-section {
  width:100%;
  margin-top:2rem;
}

/* REVIEW POPUP */

.review-modal-overlay {
  position:fixed;
  inset:0;
  z-index:3000;
  display:grid;
  place-items:center;
  padding:1rem;
  background:rgba(20,18,15,.5);
  backdrop-filter:blur(5px);
}

.review-modal {
  width:min(620px,100%);
  max-height:calc(100vh - 2rem);
  overflow-y:auto;
  padding:1.5rem;
  border:2px solid var(--x-ink);
  border-radius:24px;
  background:var(--x-card);
  box-shadow:10px 10px 0 var(--x-ink);
}

.review-modal-header {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:1rem;
  margin-bottom:1.3rem;
}

.review-modal-eyebrow {
  margin-bottom:.25rem;
  font-family:var(--x-mono);
  font-size:.72rem;
  font-weight:800;
  letter-spacing:.08em;
}

.review-modal-close {
  width:44px;
  height:44px;
  flex-shrink:0;
  display:grid;
  place-items:center;
  border:1.5px solid var(--x-ink);
  border-radius:50%;
  background:white;
  color:var(--x-ink);
  font-size:1.45rem;
  font-weight:800;
  line-height:1;
  box-shadow:3px 3px 0 var(--x-ink);
}

.review-modal-close:disabled {
  opacity:.5;
  cursor:not-allowed;
}

/* MOBILE */

@media(max-width:991.98px) {
  .reviews-scroll {
    height:430px;
    overflow-y:auto;
    overflow-x:hidden;
    padding-right:.7rem;
    scrollbar-gutter:stable;
    overscroll-behavior-y:contain;
    touch-action:pan-y;
    -webkit-overflow-scrolling:touch;
  }

  .reviews-section {
    margin-bottom:2rem;
  }

  .map-section {
    margin-top:1rem;
  }
}

@media(max-width:575.98px) {
  .community-reviews {
    padding:1rem;
    border-radius:18px;
  }

  .community-reviews-header {
    align-items:stretch;
    flex-direction:column;
  }

  .review-button {
    width:100%;
  }

  .review-modal {
    padding:1.15rem;
    border-radius:20px;
  }
}
</style>