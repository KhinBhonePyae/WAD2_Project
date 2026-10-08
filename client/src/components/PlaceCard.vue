<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import SuitabilityScore from './SuitabilityScore.vue'
import CrowdMeter from './CrowdMeter.vue'
import StarRating from './StarRating.vue'

const props = defineProps({ place: Object, score: Number, saved: Boolean })
const emit = defineEmits(['toggle-save'])

// Placeholder artwork until the Places API photos are wired in.
const gradients = {
  lib1: ['#9DD1F6', '#C4AAE9'], cafe1: ['#AFE4CB', '#67BAF5'],
  lib2: ['#C6E2F7', '#AFE4CB'], terrace1: ['#F4C9D7', '#C4AAE9'],
  pod1: ['#C4AAE9', '#9DD1F6'], cafe2: ['#F8D69B', '#F4C9D7'],
}
const art = computed(() => {
  const [a, b] = gradients[props.place.photo] || ['#C6E2F7', '#DBCDF0']
  return `linear-gradient(135deg, ${a}, ${b})`
})
const facilityLabels = { wifi: 'Wi-Fi', sockets: 'Sockets', fnb: 'F&B', water: 'Water', toilets: 'Toilets', quiet: 'Quiet' }
</script>

<template>
  <article class="ss-card" data-test="place-card">
    <div class="ss-card__media" :style="{ background: art }">
      <button class="ss-fav" type="button" :aria-pressed="saved"
              :aria-label="saved ? 'Remove from saved' : 'Save this place'"
              data-test="fav" @click="$emit('toggle-save', place.id)">
        {{ saved ? '♥' : '♡' }}
      </button>
    </div>

    <div class="ss-card__body">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <h3 class="ss-card__title">
          <RouterLink :to="'/places/' + place.id" class="text-decoration-none"
                      style="color:inherit" data-test="place-link">{{ place.name }}</RouterLink>
        </h3>
        <SuitabilityScore :score="score" />
      </div>

      <div class="ss-meta">{{ place.area }} · {{ place.hours }}</div>

      <div class="d-flex flex-wrap gap-1">
        <span class="ss-badge" :class="place.openNow ? 'ss-badge--green' : 'ss-badge--pink'">
          {{ place.openNow ? '● Open now' : 'Closed' }}
        </span>
        <span class="ss-badge ss-badge--neutral">{{ place.indoor ? 'Indoor' : 'Outdoor' }}</span>
        <span v-for="f in place.facilities.slice(0, 3)" :key="f" class="ss-badge ss-badge--sky">
          {{ facilityLabels[f] || f }}
        </span>
      </div>

      <div class="ss-card__foot">
        <CrowdMeter :level="place.crowdLevel" />
        <StarRating :value="place.rating" :count="place.reviewCount" />
      </div>
    </div>
  </article>
</template>
