<script setup>
import { ref, computed, watch } from 'vue'
import FilterChips from './FilterChips.vue'
import CustomSelect from './CustomSelect.vue'
import { DEFAULT_PREFS, RADIUS_OPTIONS } from '../utils/searchFilters'
import { FACILITY_LABELS } from '../utils/suitability'

const props = defineProps({
  modelValue: Object,
  facilityOptions: { type: Array, default: () => [] },
  areaOptions: { type: Array, default: () => [] },
  hasPreferences: { type: Boolean, default: false },
})
const emit = defineEmits(['apply', 'reset', 'reset-to-preferences'])

// State to track if the mobile menu is open
const showMobileFilters = ref(false)

const local = ref(JSON.parse(JSON.stringify(props.modelValue)))
watch(() => props.modelValue, (v) => (local.value = JSON.parse(JSON.stringify(v))), { deep: true })

const locating = ref(false)
const locationError = ref('')

async function useMyLocation() {
  if (!navigator.geolocation) {
    locationError.value = 'This browser does not support location.'
    local.value.nearbyOnly = false
    return
  }
  locating.value = true
  locationError.value = ''
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      local.value.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      local.value.nearbyOnly = true
      locating.value = false
    },
    (err) => {
      locating.value = false
      locationError.value = err.code === 1
          ? 'Location permission denied — allow it in your browser to use this filter.'
          : 'Could not get your location. Please try again.'
      local.value.nearbyOnly = false
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  )
}

watch(() => local.value.nearbyOnly, (on) => {
    if (on && !local.value.userLocation && !locating.value) useMyLocation()
})

const chipOptions = computed(() =>
  props.facilityOptions.map((f) => ({ value: f, label: FACILITY_LABELS[f] || f }))
)

const formattedAreaOptions = computed(() => [
  { value: '', label: 'All areas' },
  ...props.areaOptions.map(a => ({ value: a, label: a }))
])

const settingOptions = [
  { value: 'any', label: 'Any' },
  { value: 'indoor', label: 'Indoor only' },
  { value: 'outdoor', label: 'Outdoor only' }
]

const crowdOptions = [
  { value: 'any', label: 'Any' },
  { value: 'moderate', label: 'Moderate or quieter' },
  { value: 'quiet', label: 'Quiet only' }
]

const ratingOptions = [
  { value: 0, label: 'Any' },
  { value: 3, label: '3+ stars' },
  { value: 3.5, label: '3.5+ stars' },
  { value: 4, label: '4+ stars' },
  { value: 4.5, label: '4.5+ stars' }
]

function toggleFacility(value) {
  const i = local.value.facilities.indexOf(value)
  if (i >= 0) local.value.facilities.splice(i, 1)
  else local.value.facilities.push(value)
}

function apply() { 
  emit('apply', JSON.parse(JSON.stringify(local.value))) 
  showMobileFilters.value = false 
}

function reset() { 
  local.value = { ...DEFAULT_PREFS, facilities: [] }
  emit('reset') 
}
</script>

<template>
  <button 
          :class="showMobileFilters ? 'btn-primary' : 'btn-outline-primary'"
          class="btn d-lg-none w-100 mb-2" 
          @click="showMobileFilters = !showMobileFilters" 
          data-test="filter-toggle">
    {{ showMobileFilters ? 'Hide Filters' : 'Filters' }}
  </button>

  <div class="filter-collapse-wrapper" :class="{ 'is-open': showMobileFilters }">
    <div class="filter-collapse-inner">
      <div class="card card-body mb-3" data-test="filter-panel">
        
        <h6>Facilities I need</h6>
        <FilterChips :options="chipOptions" :selected="local.facilities" @toggle="toggleFacility" />
        <div class="form-check form-switch mt-2">
          <input class="form-check-input" type="checkbox" id="strict" v-model="local.strictFacilities"
            data-test="strict-facilities" />
          <label class="form-check-label small" for="strict">Must have all selected</label>
        </div>

        <h6 class="mt-3">Area</h6>
        <CustomSelect v-model="local.area" :options="formattedAreaOptions" data-test="area-select" />

        <h6 class="mt-3">Distance</h6>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="nearbyOnly" v-model="local.nearbyOnly"
            data-test="nearby-toggle" />
          <label class="form-check-label" for="nearbyOnly">Only show places near me</label>
        </div>

        <div v-if="locationError" class="small text-danger mt-1" data-test="location-error">
          {{ locationError }}
        </div>

        <div v-if="local.nearbyOnly" class="mt-2">
          <label class="form-label small mb-1" for="radius">Within</label>
          <CustomSelect v-model="local.radiusKm" :options="RADIUS_OPTIONS" data-test="radius-select" />
          <button type="button" class="btn btn-outline-primary btn-sm w-100 mt-2" :disabled="locating"
            @click="useMyLocation" data-test="use-location">
            {{ locating ? 'Locating…' : (local.userLocation ? 'Update my location' : 'Use my location') }}
          </button>
          <div v-if="local.userLocation" class="small text-success mt-1" data-test="location-ok">
            Location set — filtering within {{ local.radiusKm }} km
          </div>
        </div>

        <h6 class="mt-3">Indoor / outdoor</h6>
        <CustomSelect v-model="local.setting" :options="settingOptions" data-test="setting-select" />

        <h6 class="mt-3">Crowd level</h6>
        <CustomSelect v-model="local.maxCrowd" :options="crowdOptions" data-test="crowd-select" />

        <h6 class="mt-3">Minimum rating</h6>
        <CustomSelect v-model="local.minRating" :options="ratingOptions" />

        <div class="form-check form-switch mt-3">
          <input class="form-check-input" type="checkbox" id="openNow" v-model="local.openNowOnly" data-test="open-now" />
          <label class="form-check-label" for="openNow">Open now</label>
        </div>

        <div class="form-check form-switch mt-2">
          <input class="form-check-input" type="checkbox" id="freeEntry" v-model="local.freeEntryOnly"
            data-test="free-entry" />
          <label class="form-check-label" for="freeEntry">Free entry</label>
        </div>

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-primary flex-fill" @click="apply" :disabled="locating"
            data-test="apply-filters">Apply</button>
          <button class="btn btn-outline-secondary flex-fill" @click="reset" data-test="reset-filters">Reset</button>
        </div>

        <button v-if="hasPreferences" class="btn btn-link btn-sm w-100 mt-2 p-0" @click="emit('reset-to-preferences')"
          data-test="reset-to-preferences">
          Use my profile preferences
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-collapse-wrapper {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out;
}

.filter-collapse-wrapper.is-open {
  max-height: 1200px; 
  opacity: 1;
}

@media (min-width: 992px) {
  .filter-collapse-wrapper {
    max-height: none !important;
    overflow: visible !important;
    opacity: 1 !important;
  }
}

/* Removes the sticky focus state on the mobile button */
button[data-test="filter-toggle"]:focus,
button[data-test="filter-toggle"]:active {
  outline: none !important;
  box-shadow: none !important;
}
</style>