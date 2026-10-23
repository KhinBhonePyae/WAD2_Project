<script setup>
/* Up to 5 reviews saved from Google Places by import-google-places.js.
 * Google's terms require showing the author name and linking to their profile. */
import StarRating from './StarRating.vue'

defineProps({ place: { type: Object, required: true } })
</script>

<template>
  <section v-if="place.googleReviews?.length" class="mt-4" data-test="google-reviews">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <h3 class="h5 mb-0">From Google</h3>
      <a v-if="place.googleMapsUri" :href="place.googleMapsUri" target="_blank" rel="noopener" class="ss-meta">See all {{ place.googleRatingCount }} reviews on Google Maps ↗</a>
    </div>

    <div class="row g-3">
      <div v-for="(r, i) in place.googleReviews" :key="i" class="col-12 col-md-6">
        <div class="ss-card h-100 p-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <img v-if="r.authorPhoto" :src="r.authorPhoto" alt="" width="28" height="28" class="rounded-circle" referrerpolicy="no-referrer">
            <a v-if="r.authorUri" :href="r.authorUri" target="_blank" rel="noopener" class="fw-bold text-decoration-none">{{ r.author }}</a>
            <span v-else class="fw-bold">{{ r.author }}</span>
            <span class="ss-meta ms-auto">{{ r.relativeTime }}</span>
          </div>
          <StarRating :value="r.rating" />
          <p class="mb-0 mt-2 google-review-text">{{ r.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.google-review-text {
  display:-webkit-box;
  -webkit-line-clamp:6;
  -webkit-box-orient:vertical;
  overflow:hidden;
}
</style>
