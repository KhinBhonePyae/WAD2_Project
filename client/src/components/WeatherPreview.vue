<!-- DEV ONLY - weather scene preview panel. Never shows in production builds.
     To remove: delete this file and the two WeatherPreview lines in HomeView.vue. -->
<script setup>
const props = defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue'])

const dev = import.meta.env.DEV
const KINDS = [
  { kind: 'clear', label: 'Clear' },
  { kind: 'partly', label: 'Mostly sunny' },
  { kind: 'cloudy', label: 'Overcast' },
  { kind: 'rain', label: 'Raining' },
]

let live = null   // the real weather, restored by "Live"

function show(kind, isDay) {
  if (!live) live = props.modelValue
  const base = live || { temp: 30, precipitation: 0, code: 0, icon: '' }   // in case the real fetch failed
  const raining = kind === 'rain'
  emit('update:modelValue', {
    ...base,
    kind,
    isDay,
    raining,
    fair: kind === 'clear' || kind === 'partly',
    label: KINDS.find(k => k.kind === kind).label,
  })
}

function backToLive() {
  if (live) emit('update:modelValue', live)
  live = null
}
</script>

<template>
  <div v-if="dev" class="wp" role="group" aria-label="Weather preview (development only)">
    <strong class="wp__title">Weather preview · dev</strong>
    <div class="wp__row">
      <button v-for="k in KINDS" :key="k.kind" type="button" class="wp__btn"
              :aria-pressed="live !== null && modelValue?.kind === k.kind"
              @click="show(k.kind, modelValue?.isDay ?? true)">
        {{ k.label }}
      </button>
    </div>
    <div class="wp__row">
      <button type="button" class="wp__btn" :aria-pressed="modelValue?.isDay !== false"
              @click="show(modelValue?.kind || 'clear', true)">Day</button>
      <button type="button" class="wp__btn" :aria-pressed="modelValue?.isDay === false"
              @click="show(modelValue?.kind || 'clear', false)">Night</button>
      <button type="button" class="wp__btn wp__btn--live" @click="backToLive">Live weather</button>
    </div>
  </div>
</template>

<style scoped>
.wp {
  position: fixed; left: var(--ss-4); bottom: var(--ss-4); z-index: 1040;
  display: flex; flex-direction: column; gap: var(--ss-2);
  max-width: calc(100vw - 2 * var(--ss-4));
  padding: var(--ss-3); border-radius: var(--ss-radius);
  background: var(--ss-bg); border: 1px dashed var(--ss-border-strong);
  box-shadow: var(--ss-shadow-lg); font-size: var(--ss-text-xs);
}
.wp__title { color: var(--ss-text-muted); text-transform: uppercase; letter-spacing: .06em; }
.wp__row { display: flex; flex-wrap: wrap; gap: var(--ss-1); }
.wp__btn {
  padding: .25rem .6rem; border-radius: var(--ss-radius-pill);
  border: 1px solid var(--ss-border); background: var(--ss-surface); color: var(--ss-text);
}
.wp__btn[aria-pressed="true"] { background: var(--ss-primary); border-color: var(--ss-primary); color: var(--ss-text-invert); }
.wp__btn--live { margin-left: auto; color: var(--ss-primary); }
</style>
