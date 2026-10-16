<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ reviews:{ type:Array, default:() => [] } })

const days = [
  { label:'MON', value:1 },
  { label:'TUE', value:2 },
  { label:'WED', value:3 },
  { label:'THU', value:4 },
  { label:'FRI', value:5 }
]

const today = new Date().getDay()
const selectedDay = ref(today >= 1 && today <= 5 ? today : 1)

const selectedDayLabel = computed(() => days.find(d => d.value === selectedDay.value)?.label || 'MON')

const dayReviews = computed(() => props.reviews.filter(r => {
  const date = new Date(r.createdAt)
  return !Number.isNaN(date.getTime()) && date.getDay() === selectedDay.value
}))

const quietCount = computed(() => dayReviews.value.filter(r => r.crowdLevel === 'quiet').length)
const moderateCount = computed(() => dayReviews.value.filter(r => r.crowdLevel === 'moderate').length)
const packedCount = computed(() => dayReviews.value.filter(r => r.crowdLevel === 'packed').length)
const total = computed(() => dayReviews.value.length)

function pct(n) {
  if (!total.value) return 0
  return Math.round((n / total.value) * 100)
}
</script>

<template>
  <section class="crowd-card">
    <div class="crowd-head">
      <div>
        <p class="crowd-kicker">COMMUNITY INSIGHTS</p>
        <h3>Crowd reports</h3>
        <p class="crowd-sub">Based on {{ total }} {{ selectedDayLabel }} community report{{ total === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <div class="day-tabs">
      <button v-for="day in days" :key="day.value" type="button" class="day-tab" :class="{ active:selectedDay === day.value }" @click="selectedDay = day.value">{{ day.label }}</button>
    </div>

    <div v-if="total">
      <div class="crowd-row">
        <div class="crowd-label quiet">Quiet</div>
        <div class="crowd-track"><div class="crowd-fill quiet" :style="{ width:pct(quietCount) + '%' }"></div></div>
        <div class="crowd-value">{{ quietCount }} ({{ pct(quietCount) }}%)</div>
      </div>

      <div class="crowd-row">
        <div class="crowd-label moderate">Moderate</div>
        <div class="crowd-track"><div class="crowd-fill moderate" :style="{ width:pct(moderateCount) + '%' }"></div></div>
        <div class="crowd-value">{{ moderateCount }} ({{ pct(moderateCount) }}%)</div>
      </div>

      <div class="crowd-row">
        <div class="crowd-label packed">Packed</div>
        <div class="crowd-track"><div class="crowd-fill packed" :style="{ width:pct(packedCount) + '%' }"></div></div>
        <div class="crowd-value">{{ packedCount }} ({{ pct(packedCount) }}%)</div>
      </div>
    </div>

    <div v-else class="crowd-empty">No crowd reports for {{ selectedDayLabel }} yet.</div>
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

.day-tabs {
  display:flex;
  align-items:center;
  gap:1.8rem;
  margin-bottom:1.4rem;
}

.day-tab {
  position:relative;
  padding:.35rem 0 .6rem;
  border:0;
  background:transparent;
  color:var(--x-ink);
  font-size:.8rem;
  font-weight:800;
}

.day-tab::after {
  content:'';
  position:absolute;
  left:0;
  right:0;
  bottom:0;
  height:2px;
  background:transparent;
}

.day-tab.active::after { background:var(--x-ink); }

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
  .day-tabs { gap:1.2rem; overflow-x:auto; }
  .crowd-row { grid-template-columns:1fr; gap:.45rem; }
  .crowd-value { text-align:left; }
  .crowd-head h3 { font-size:1.65rem; }
}
</style>