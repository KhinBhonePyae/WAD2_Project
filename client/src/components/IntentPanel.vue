<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlaceIntents, fetchMyIntents, addIntent, removeIntent, LEVEL_LABELS, LEVEL_BADGES } from '../utils/intents.js'

const props = defineProps({ place: Object })
const emit = defineEmits(['changed'])
const router = useRouter()

const slots = ref([])
const mine = ref([])
const loading = ref(true)
const busyKey = ref('')
const errorMessage = ref('')

const NLB_BOOKING_URL = 'https://www.nlb.gov.sg/main/services/using-the-library/Plan-your-Visit'

const days = computed(() => ['Today', 'Tomorrow'].map(day => ({ day, slots: slots.value.filter(s => s.day === day) })).filter(d => d.slots.length))

function keyOf(s) {
  return `${s.date}-${s.slot}`
}

function isMine(s) {
  return mine.value.some(i => i.placeId === props.place.id && i.date === s.date && i.slot === s.slot)
}

async function load() {
  try {
    const [placeSlots, myIntents] = await Promise.all([fetchPlaceIntents(props.place.id), fetchMyIntents()])
    slots.value = placeSlots
    mine.value = myIntents
  } catch (e) {
    console.error('Could not load plans', e)
    errorMessage.value = 'Could not load who is planning to go.'
  } finally {
    loading.value = false
  }
}

async function toggle(s) {
  if (!localStorage.getItem('token')) {
    router.push('/login')
    return
  }

  busyKey.value = keyOf(s)
  errorMessage.value = ''

  try {
    if (isMine(s)) await removeIntent(props.place.id, s.date, s.slot)
    else await addIntent(props.place.id, s.date, s.slot)
    await load()
    emit('changed')
  } catch (e) {
    if (e.response?.status === 401) {
      router.push('/login')
      return
    }
    errorMessage.value = e.response?.data?.error || 'Could not update your plan. Please try again.'
  } finally {
    busyKey.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="ss-card h-auto p-4" data-test="intent-panel">
    <h2 class="h6 mb-1">Planning to go?</h2>
    <p class="ss-meta mb-3">Let others know when you're heading here, and see how busy it's likely to be.</p>

    <div v-if="loading" class="ss-skeleton" style="height:120px"></div>

    <template v-else>
      <p v-if="!days.length && !errorMessage" class="ss-meta mb-2" data-test="intent-none">Not open in the next two
        days, so there's nothing to plan for.</p>

      <div class="row g-4 mb-2">
        <div v-for="d in days" :key="d.day" class="col-12 col-md-6">
          <div class="ss-meta fw-bold mb-2">{{ d.day }}</div>

          <div v-for="s in d.slots" :key="keyOf(s)"
            class="d-flex align-items-center justify-content-between gap-2 py-2 border-bottom"
            :data-test="'intent-slot-' + s.slot">
            <div>
              <div class="fw-semibold">{{ s.label }}</div>
              <div class="ss-meta">
                <span v-if="s.count" data-test="intent-count">{{ s.count }} planning to go</span>
                <span v-else>No one yet</span>
                <span v-if="s.level" class="ss-badge ms-1" :class="LEVEL_BADGES[s.level]">{{ LEVEL_LABELS[s.level]
                }}</span>
              </div>
            </div>

            <button type="button" class="btn btn-sm text-nowrap"
              :class="isMine(s) ? 'btn-outline-primary' : 'btn-ghost'" :disabled="busyKey === keyOf(s)"
              :aria-pressed="isMine(s)" data-test="intent-toggle" @click="toggle(s)">{{ isMine(s) ? '✓ Going' : "I'm going" }}</button>
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="text-danger small mb-2" role="alert">{{ errorMessage }}</p>
    </template>

    <a v-if="place.branchCode && days.length" :href="NLB_BOOKING_URL" target="_blank" rel="noopener"
      class="btn btn-outline-primary btn-sm w-100 mt-1" data-test="nlb-booking">Book a seat on NLB ↗</a>
  </div>
</template>
