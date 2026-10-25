<script setup>
/* "How busy is it?" card. Shows the latest crowd report, who is planning to
 * go next, and the split of every report so far. Reports are real: one-tap
 * check-ins plus the crowd level picked in each review. */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlaceCrowd, fetchMyCheckin, checkIn, undoCheckin, CROWD_LABELS, isFresh, timeAgo } from '../utils/crowd.js'

const props = defineProps({ place:{ type:Object, required:true } })
const emit = defineEmits(['reported'])
const router = useRouter()

const levels = ['quiet', 'moderate', 'packed']
const crowd = ref({ latest:null, counts:{ quiet:0, moderate:0, packed:0 }, total:0 })
const loading = ref(true)
const busy = ref(false)
const myLevel = ref('')
const errorMessage = ref('')

const latest = computed(() => crowd.value.latest)
const fresh = computed(() => latest.value && isFresh(latest.value.at))
const canCheckIn = computed(() => props.place.openNow)

function pct(level) {
  if (!crowd.value.total) return 0
  return Math.round((crowd.value.counts[level] / crowd.value.total) * 100)
}

async function load() {
  try {
    const [data, mine] = await Promise.all([fetchPlaceCrowd(props.place.id), fetchMyCheckin(props.place.id)])
    crowd.value = data
    myLevel.value = mine || ''
  } catch (e) {
    console.error('Could not load crowd reports', e)
    errorMessage.value = 'Could not load crowd reports.'
  } finally {
    loading.value = false
  }
}

// Tapping your own level again takes the report back
function tap(level) {
  if (myLevel.value === level) undo()
  else report(level)
}

async function undo() {
  busy.value = true
  errorMessage.value = ''

  try {
    await undoCheckin(props.place.id)
    await load()
    emit('reported')
  } catch (e) {
    if (e.response?.status === 401) {
      router.push('/login')
      return
    }
    // the hour is up (or it was already removed); just show the current state
    if (e.response?.status === 404) await load()
    else errorMessage.value = 'Could not undo your report. Please try again.'
  } finally {
    busy.value = false
  }
}

async function report(level) {
  if (!localStorage.getItem('token')) {
    router.push('/login')
    return
  }

  busy.value = true
  errorMessage.value = ''

  try {
    await checkIn(props.place.id, level)
    await load()
    emit('reported', level)
  } catch (e) {
    if (e.response?.status === 401) {
      router.push('/login')
      return
    }
    errorMessage.value = e.response?.data?.error || 'Could not send your report. Please try again.'
  } finally {
    busy.value = false
  }
}

// reviews carry a crowd level too, so reload when the place page changes them
defineExpose({ reload:load })
watch(() => props.place.id, load)
onMounted(load)
</script>

<template>
  <section class="crowd-card" data-test="crowd-card">
    <div class="crowd-head">
      <p class="crowd-kicker">COMMUNITY INSIGHTS</p>
      <h3>How busy is it?</h3>
    </div>

    <div v-if="loading" class="crowd-empty">Loading crowd reports...</div>

    <template v-else>
      <div v-if="latest" class="crowd-now" data-test="crowd-latest">
        <span class="crowd-dot" :class="latest.level"></span>
        <div>
          <div class="crowd-now-title">
            {{ fresh ? CROWD_LABELS[latest.level] + ' right now' : 'Last reported ' + CROWD_LABELS[latest.level].toLowerCase() }}
          </div>
          <div class="crowd-sub">Reported {{ timeAgo(latest.at) }} in a {{ latest.source }}</div>
        </div>
      </div>
      <p v-else class="crowd-sub mb-3" data-test="crowd-none">No one has reported the crowd here yet. Be the first!</p>

      <p v-if="place.intent" class="crowd-intent" data-test="crowd-intent">
        {{ place.intent.count }} {{ place.intent.count === 1 ? 'person is' : 'people are' }} planning to go
        {{ place.intent.day.toLowerCase() }}, {{ place.intent.label.toLowerCase() }}
      </p>

      <div v-if="crowd.total" class="crowd-bars">
        <p class="crowd-sub mb-2">All {{ crowd.total }} report{{ crowd.total === 1 ? '' : 's' }} so far</p>
        <div v-for="level in levels" :key="level" class="crowd-row">
          <div class="crowd-label">{{ CROWD_LABELS[level] }}</div>
          <div class="crowd-track"><div class="crowd-fill" :class="level" :style="{ width:pct(level) + '%' }"></div></div>
          <div class="crowd-value">{{ crowd.counts[level] }} ({{ pct(level) }}%)</div>
        </div>
      </div>

      <div class="crowd-checkin" data-test="crowd-checkin">
        <template v-if="canCheckIn">
          <p v-if="myLevel" class="crowd-checkin-title" data-test="checkin-thanks">
            Thanks! You can change it within the hour, or
            <button type="button" class="crowd-undo" :disabled="busy" data-test="checkin-undo" @click="undo">undo</button>.
          </p>
          <p v-else class="crowd-checkin-title">Here now? Tap how busy it is:</p>
          <div class="crowd-buttons">
            <button v-for="level in levels" :key="level" type="button" class="crowd-btn" :class="[level, { active:myLevel === level }]"
              :disabled="busy" :aria-pressed="myLevel === level" :data-test="'checkin-' + level" @click="tap(level)">
              {{ CROWD_LABELS[level] }}
            </button>
          </div>
        </template>
        <p v-else class="crowd-sub mb-0">Check-ins open while this place is open.</p>
      </div>

      <p v-if="errorMessage" class="text-danger small mt-2 mb-0" role="alert">{{ errorMessage }}</p>
    </template>
  </section>
</template>

<style scoped>
.crowd-card {
  padding:1.5rem;
  border:1px solid var(--x-ink);
  border-radius:24px;
  background:linear-gradient(135deg,#d9ccff 0%,#b8a9ff 100%);
  box-shadow:var(--x-pop);
}

.crowd-head { margin-bottom:1rem; }

.crowd-kicker {
  margin:0 0 .35rem;
  font-size:.8rem;
  font-weight:800;
  letter-spacing:.12em;
  color:var(--x-ink);
}

.crowd-head h3 {
  margin:0;
  font-size:2rem;
  font-weight:800;
  color:var(--x-ink);
}

.crowd-sub {
  margin:.35rem 0 0;
  color:rgba(21,19,15,.75);
}

.crowd-row {
  display:grid;
  grid-template-columns:130px 1fr 110px;
  align-items:center;
  gap:1rem;
  margin-bottom:.9rem;
}

.crowd-row:last-child { margin-bottom:0; }

.crowd-label {
  font-weight:700;
  color:var(--x-ink);
}

.crowd-now {
  display:flex;
  align-items:center;
  gap:.8rem;
  margin-bottom:1rem;
  padding:.8rem 1rem;
  border:1px solid var(--x-ink);
  border-radius:16px;
  background:rgba(255,255,255,.75);
}

.crowd-now-title {
  font-size:1.15rem;
  font-weight:800;
  color:var(--x-ink);
}

.crowd-dot {
  flex:0 0 auto;
  width:18px;
  height:18px;
  border:1px solid var(--x-ink);
  border-radius:50%;
}

.crowd-intent {
  margin:0 0 1rem;
  font-weight:700;
  color:var(--x-ink);
}

.crowd-bars { margin-bottom:1.2rem; }

.crowd-checkin {
  padding-top:1rem;
  border-top:1px solid rgba(21,19,15,.25);
}

.crowd-checkin-title {
  margin:0 0 .6rem;
  font-weight:700;
  color:var(--x-ink);
}

.crowd-buttons {
  display:flex;
  flex-wrap:wrap;
  gap:.6rem;
}

.crowd-btn {
  padding:.45rem 1.1rem;
  border:1px solid var(--x-ink);
  border-radius:999px;
  background:rgba(255,255,255,.75);
  color:var(--x-ink);
  font-weight:700;
}

.crowd-undo {
  padding:0;
  border:0;
  background:none;
  color:var(--x-ink);
  font-weight:800;
  text-decoration:underline;
}

.crowd-btn:hover:not(:disabled),
.crowd-btn.active { box-shadow:3px 3px 0 var(--x-ink); }
.crowd-btn.active.quiet, .crowd-dot.quiet { background:#c9ea4e; }
.crowd-btn.active.moderate, .crowd-dot.moderate { background:#f0d85a; }
.crowd-btn.active.packed, .crowd-dot.packed { background:#f27a3d; }

.crowd-track {
  height:22px;
  border:1px solid var(--x-ink);
  border-radius:999px;
  overflow:hidden;
  background:rgba(255,255,255,.75);
}

.crowd-fill { height:100%; border-radius:999px; }
.crowd-fill.quiet { background:#c9ea4e; }
.crowd-fill.moderate { background:#f0d85a; }
.crowd-fill.packed { background:#f27a3d; }

.crowd-value {
  text-align:right;
  font-weight:700;
  color:var(--x-ink);
}

.crowd-empty {
  padding:1rem 0 .2rem;
  color:rgba(21,19,15,.65);
  font-size:.9rem;
}

@media(max-width:768px) {
  .crowd-row { grid-template-columns:1fr; gap:.45rem; }
  .crowd-value { text-align:left; }
  .crowd-head h3 { font-size:1.65rem; }
}
</style>