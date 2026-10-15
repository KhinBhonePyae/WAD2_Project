<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL, authConfig } from '../utils/api.js'

const props = defineProps({
  place: { type: Object, required: true }
})

const router = useRouter()
const open = ref(false)
const category = ref('')
const message = ref('')
const busy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const remaining = computed(() => 600 - message.value.length)

const categories = [
  { value: 'hours', label: 'Opening hours' },
  { value: 'facilities', label: 'Facilities' },
  { value: 'address', label: 'Address / location' },
  { value: 'photos', label: 'Photos' },
  { value: 'capacity', label: 'Capacity / seats' },
  { value: 'closure', label: 'Open / closure status' },
  { value: 'other', label: 'Other information' }
]

function showReport() {
  if (!localStorage.getItem('token')) {
    router.push({ path: '/login', query: { redirect: `/places/${props.place.id}` } })
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  open.value = true
}

function closeReport() {
  if (busy.value) return
  open.value = false
}

async function submitReport() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!category.value) {
    errorMessage.value = 'Choose what information is incorrect.'
    return
  }

  if (message.value.trim().length < 5) {
    errorMessage.value = 'Please give a little more detail.'
    return
  }

  busy.value = true

  try {
    const { data } = await axios.post(`${BASE_URL}/reports`, {
      placeId: props.place.id,
      category: category.value,
      message: message.value.trim()
    }, authConfig())

    successMessage.value = data.message || 'Thanks! Your report has been sent.'
    category.value = ''
    message.value = ''
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      router.push('/login')
      return
    }

    errorMessage.value = error.response?.data?.error || 'Could not submit your report. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="report-wrap">
    <button type="button" class="report-trigger" @click="showReport">
      <span aria-hidden="true">⚑</span>
      Report incorrect information
    </button>

    <div v-if="open" class="report-overlay" @click.self="closeReport">
      <div class="report-card" role="dialog" aria-modal="true" aria-labelledby="reportTitle">
        <div class="report-head">
          <div>
            <div class="report-eyebrow">HELP KEEP LOCKEDIN ACCURATE</div>
            <h2 id="reportTitle" class="report-title">Report an issue</h2>
            <p class="report-place">{{ place.name }}</p>
          </div>
          <button type="button" class="report-close" :disabled="busy" aria-label="Close" @click="closeReport">×</button>
        </div>

        <div v-if="successMessage" class="report-success">
          <strong>Report sent</strong>
          <span>{{ successMessage }}</span>
          <button type="button" class="btn btn-primary btn-sm mt-3" @click="closeReport">Done</button>
        </div>

        <form v-else @submit.prevent="submitReport">
          <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

          <label class="report-label" for="reportCategory">What is incorrect?</label>
          <select id="reportCategory" v-model="category" class="report-input" required>
            <option value="" disabled>Select an issue</option>
            <option v-for="item in categories" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>

          <label class="report-label" for="reportMessage">Tell us what should be corrected</label>
          <textarea id="reportMessage" v-model="message" class="report-input report-textarea" maxlength="600" rows="5" placeholder="Example: The library now closes at 9pm instead of 10pm." required></textarea>
          <div class="report-count">{{ remaining }} characters left</div>

          <div class="report-actions">
            <button type="button" class="btn btn-outline-primary" :disabled="busy" @click="closeReport">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? 'Sending...' : 'Submit report' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-wrap { margin-top: 1.25rem; }
.report-trigger { display: inline-flex; align-items: center; gap: .45rem; padding: .55rem .9rem; border: 1.5px solid var(--x-ink); border-radius: 999px; background: var(--x-paper-2); color: var(--x-ink); font-size: .78rem; font-weight: 800; box-shadow: 3px 3px 0 var(--x-ink); }
.report-trigger:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 var(--x-ink); }
.report-overlay { position: fixed; inset: 0; z-index: 2100; display: grid; place-items: center; padding: 1rem; background: rgba(20,18,15,.48); backdrop-filter: blur(4px); }
.report-card { width: min(560px,100%); padding: 1.4rem; border: 2px solid var(--x-ink); border-radius: 22px; background: var(--x-card); box-shadow: 9px 9px 0 var(--x-ink); }
.report-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.report-eyebrow { font-family: var(--x-mono); font-size: .68rem; font-weight: 800; letter-spacing: .06em; }
.report-title { margin: .2rem 0 0; font-size: 1.8rem; }
.report-place { margin: .3rem 0 0; color: var(--x-muted); font-size: .85rem; }
.report-close { width: 38px; height: 38px; flex-shrink: 0; border: 1.5px solid var(--x-ink); border-radius: 50%; background: white; color: var(--x-ink); font-size: 1.35rem; font-weight: 800; line-height: 1; }
.report-label { display: block; margin: .8rem 0 .35rem; font-size: .8rem; font-weight: 800; }
.report-input { width: 100%; padding: .75rem .85rem; border: 2px solid var(--x-ink); border-radius: 12px; background: white; color: var(--x-ink); outline: none; }
.report-input:focus { box-shadow: 0 0 0 3px var(--x-lilac); }
.report-textarea { resize: vertical; min-height: 130px; }
.report-count { margin-top: .3rem; text-align: right; color: var(--x-muted); font-size: .68rem; }
.report-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.25rem; }
.report-success { padding: 1rem; border: 1.5px solid var(--x-ink); border-radius: 14px; background: var(--x-lime); }
.report-success strong, .report-success span { display: block; }
.report-success span { margin-top: .25rem; font-size: .85rem; }
@media (max-width: 575.98px) { .report-actions { flex-direction: column-reverse; } .report-actions .btn { width: 100%; } }
</style>
