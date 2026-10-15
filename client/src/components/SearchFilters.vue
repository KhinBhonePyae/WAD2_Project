<script setup>
import { ref, computed, watch } from 'vue'
import FilterChips from './FilterChips.vue'
import { DEFAULT_PREFS } from '../utils/searchFilters'
import { FACILITY_LABELS } from '../utils/suitability'

const props = defineProps({
  modelValue: Object,
  facilityOptions: { type: Array, default: () => [] },
  areaOptions: { type: Array, default: () => [] },
  hasPreferences: { type: Boolean, default: false },
})
const emit = defineEmits(['apply', 'reset', 'reset-to-preferences'])

function initialPrefs() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return { ...DEFAULT_PREFS, facilities: [], ...JSON.parse(saved) } }
    catch { /* corrupt entry — fall through */ }
  }

  const user = readStoredUser()
  const fromPrefs = prefsFromUserPreferences(user?.preferences)
  return { ...DEFAULT_PREFS, facilities: [], ...fromPrefs }
}


// Work on a copy; only emit when the user clicks Apply
const local = ref(JSON.parse(JSON.stringify(props.modelValue)))
watch(() => props.modelValue, (v) => (local.value = JSON.parse(JSON.stringify(v))), { deep: true })

const chipOptions = computed(() =>
  props.facilityOptions.map((f) => ({ value: f, label: FACILITY_LABELS[f] || f }))
)

function toggleFacility(value) {
  const i = local.value.facilities.indexOf(value)
  if (i >= 0) local.value.facilities.splice(i, 1)
  else local.value.facilities.push(value)

}

function apply() { emit('apply', JSON.parse(JSON.stringify(local.value))) }
function reset() { local.value = { ...DEFAULT_PREFS, facilities: [] }; emit('reset') }
</script>

<template>
  <!-- Collapsible on mobile (Bootstrap collapse), always open from lg upwards -->
  <button class="btn btn-outline-primary d-lg-none w-100 mb-2" data-bs-toggle="collapse" data-bs-target="#filterBody"
    data-test="filter-toggle">Filters</button>

  <div class="collapse d-lg-block" id="filterBody">
    <div class="card card-body mb-3" data-test="filter-panel">
      <h6>Facilities I need</h6>
      <FilterChips :options="chipOptions" :selected="local.facilities" @toggle="toggleFacility" />
      <div class="form-check form-switch mt-2">
        <input class="form-check-input" type="checkbox" id="strict" v-model="local.strictFacilities"
          data-test="strict-facilities" />
        <label class="form-check-label small" for="strict">Must have all selected</label>
      </div>

      <h6 class="mt-3">Area</h6>
      <select class="form-select" v-model="local.area" data-test="area-select">
        <option value="">All areas</option>
        <option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</option>
      </select>

      <h6 class="mt-3">Indoor / outdoor</h6>
      <select class="form-select" v-model="local.setting" data-test="setting-select">
        <option value="any">Any</option>
        <option value="indoor">Indoor only</option>
        <option value="outdoor">Outdoor only</option>
      </select>

      <h6 class="mt-3">Crowd level</h6>
      <select class="form-select" v-model="local.maxCrowd" data-test="crowd-select">
        <option value="any">Any</option>
        <option value="moderate">Moderate or quieter</option>
        <option value="quiet">Quiet only</option>
      </select>

      <h6 class="mt-3">Minimum rating</h6>
      <select class="form-select" v-model.number="local.minRating">
        <option :value="0">Any</option>
        <option v-for="n in [3, 3.5, 4, 4.5]" :key="n" :value="n">{{ n }}+ stars</option>
      </select>

      <div class="form-check form-switch mt-3">
        <input class="form-check-input" type="checkbox" id="openNow" v-model="local.openNowOnly" data-test="open-now" />
        <label class="form-check-label" for="openNow">Open now</label>
      </div>

      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-primary flex-fill" @click="apply" data-test="apply-filters">Apply</button>
        <button class="btn btn-outline-secondary flex-fill" @click="reset" data-test="reset-filters">Reset</button>
      </div>

      <button v-if="hasPreferences" class="btn btn-link btn-sm w-100 mt-2 p-0" @click="emit('reset-to-preferences')"
        data-test="reset-to-preferences">
        Use my profile preferences
      </button>
    </div>
  </div>
</template>