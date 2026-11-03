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
      
      <div class="card card-body mb-3 x-bold-container" data-test="filter-panel">
        
        <h6>Facilities I need</h6>
        <FilterChips :options="chipOptions" :selected="local.facilities" @toggle="toggleFacility" />
        
        <!-- Custom Switch -->
        <label class="x-switch mt-2">
          <input type="checkbox" v-model="local.strictFacilities" data-test="strict-facilities" />
          <span class="x-switch__track"></span>
          <span class="x-switch__label small">Must have all selected</span>
        </label>

        <!-- the four dropdowns: one column on desktop, two-up when the panel collapses -->
        <div class="x-filter-grid">
          <div>
            <h6>Area</h6>
            <CustomSelect v-model="local.area" :options="formattedAreaOptions" data-test="area-select" />
          </div>
          <div>
            <h6>Indoor / outdoor</h6>
            <CustomSelect v-model="local.setting" :options="settingOptions" data-test="setting-select" />
          </div>
          <div>
            <h6>Crowd level</h6>
            <CustomSelect v-model="local.maxCrowd" :options="crowdOptions" data-test="crowd-select" />
          </div>
          <div>
            <h6>Minimum rating</h6>
            <CustomSelect v-model="local.minRating" :options="ratingOptions" />
          </div>
        </div>

        <h6 class="mt-3">Distance</h6>
        <!-- Custom Switch -->
        <label class="x-switch">
          <input type="checkbox" v-model="local.nearbyOnly" data-test="nearby-toggle" />
          <span class="x-switch__track"></span>
          <span class="x-switch__label">Only show places near me</span>
        </label>

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

        <!-- Custom Switches -->
        <div class="x-filter-toggles mt-3">
          <label class="x-switch">
            <input type="checkbox" v-model="local.openNowOnly" data-test="open-now" />
            <span class="x-switch__track"></span>
            <span class="x-switch__label">Open now</span>
          </label>

          <label class="x-switch">
            <input type="checkbox" v-model="local.freeEntryOnly" data-test="free-entry" />
            <span class="x-switch__track"></span>
            <span class="x-switch__label">Free entry</span>
          </label>
        </div>

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-primary flex-fill" @click="apply" :disabled="locating"
            data-test="apply-filters">Apply</button>
          <button class="btn btn-outline-secondary flex-fill" @click="reset" data-test="reset-filters">Reset</button>
        </div>

        <button v-if="hasPreferences" class="profile-pref-link mt-2" @click="emit('reset-to-preferences')"
          data-test="reset-to-preferences">
          Use my profile preferences
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* --- Container Animation --- */
.filter-collapse-wrapper {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out;
}

.filter-collapse-wrapper.is-open {
  max-height: 1500px;
  opacity: 1;
}

@media (min-width: 992px) {
  .filter-collapse-wrapper {
    max-height: none !important;
    overflow: visible !important;
    opacity: 1 !important;
  }
}

/* --- Bold Container --- */
.x-bold-container {
  background-color: var(--x-card, #fff);
  border: 2px solid var(--x-ink, #111) !important;
  border-radius: 20px !important;
  box-shadow: 4px 4px 0 var(--x-ink, #111) !important;
}

/* --- THEMED TOGGLE SWITCHES --- */
.x-switch {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  gap: 10px;
  margin-bottom: 0.2rem; /* Slight spacing adjustment */
}

/* Hide the default checkbox */
.x-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* The Track */
.x-switch__track {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: var(--x-card, #fff);
  border: 2px solid var(--x-ink, #111);
  border-radius: 999px;
  box-shadow: 2px 2px 0 var(--x-ink, #111);
  transition: all 0.2s ease;
  flex-shrink: 0; /* Prevents squishing on mobile */
}

/* The Knob */
.x-switch__track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background-color: var(--x-ink, #111);
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Checked State */
.x-switch input:checked + .x-switch__track {
  background-color: var(--x-lime, #d1f529);
}

.x-switch input:checked + .x-switch__track::after {
  transform: translateX(20px);
}

/* Focus State for Accessibility */
.x-switch input:focus-visible + .x-switch__track {
  outline: 3px solid var(--x-orange, #ff5b22);
  outline-offset: 2px;
}

/* The Label */
.x-switch__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--x-ink, #111);
  line-height: 1.2;
}

.x-switch__label.small {
  font-size: 0.8rem;
}

/* Profile preferences link */
.profile-pref-link {
  width: 100%;
  border: none;
  background: none;
  padding: 0;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

/* --- Dropdown grid and switch group --- */
.x-filter-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.x-filter-toggles {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

/* Collapsible panel (below desktop): smaller text and controls, dropdowns
   two-up and switches side by side, so it takes far less height */
@media (max-width: 991.98px) {
  .x-bold-container {
    padding: .85rem .9rem;
    border-radius: 16px !important;
    box-shadow: 3px 3px 0 var(--x-ink, #111) !important;
  }

  .x-bold-container h6 {
    margin-bottom: .3rem;
    font-size: .78rem;
  }

  .x-bold-container :deep(.d-flex.flex-wrap) {
    gap: .35rem !important;
  }

  .x-bold-container :deep(.ss-chip) {
    padding: .22rem .65rem;
    border-width: 1.5px;
    font-size: .74rem;
    box-shadow: 2px 2px 0 var(--x-ink, #111);
  }

  .x-switch {
    gap: 7px;
    margin-bottom: 0;
  }

  .x-switch__track {
    width: 34px;
    height: 19px;
    border-width: 1.5px;
  }

  .x-switch__track::after {
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
  }

  .x-switch input:checked + .x-switch__track::after {
    transform: translateX(15px);
  }

  .x-switch__label,
  .x-switch__label.small {
    font-size: .76rem;
  }

  .x-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: .6rem .7rem;
    margin-top: .75rem;
  }

  .x-bold-container :deep(.ss-select-trigger) {
    padding: .3rem .6rem;
    border-radius: 10px;
    font-size: .8rem;
    box-shadow: 2px 2px 0 var(--x-ink, #111);
  }

  .x-bold-container h6.mt-3,
  .x-filter-toggles.mt-3 {
    margin-top: .75rem !important;
  }

  .x-filter-toggles {
    flex-direction: row;
    flex-wrap: wrap;
    gap: .4rem 1.2rem;
  }

  .x-bold-container .btn {
    --bs-btn-padding-y: .3rem;
    font-size: .85rem;
    box-shadow: 2px 2px 0 var(--x-ink, #111);
  }

  .x-bold-container .d-flex.gap-2.mt-3 {
    margin-top: .85rem !important;
  }

  .profile-pref-link {
    font-size: .78rem;
  }
}

/* Removes the sticky focus state on the mobile button */
button[data-test="filter-toggle"]:focus,
button[data-test="filter-toggle"]:active {
  outline: none !important;
  box-shadow: none !important;
}
</style>