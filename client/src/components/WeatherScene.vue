<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  weather: Object,
  area: { type: String, default: 'Singapore' },
  variant: { type: String, default: 'banner' },
})

const canvas = ref(null)
const rainy = computed(() => props.weather?.kind === 'rain')

let ctx = null, raf = 0, drops = [], width = 0, height = 0, observer = null
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const WIND = 0.18  

function resize() {
  const box = canvas.value.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  width = box.width
  height = box.height
  canvas.value.width = width * dpr
  canvas.value.height = height * dpr
  ctx = canvas.value.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const count = Math.round(180 * (width / 700))
  drops = Array.from({ length: count }, () => ({
    x: Math.random() * (width + 60),
    y: Math.random() * height,
    len: 12 + Math.random() * 12,
    speed: 10 + Math.random() * 5,
  }))
}

function draw() {
  ctx.clearRect(0, 0, width, height)
  // dark-blue drops on the light day sky, white drops on the dark night sky
  ctx.strokeStyle = props.weather.isDay ? 'rgba(19,93,146,.45)' : 'rgba(255,255,255,.55)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (const d of drops) {
    ctx.moveTo(d.x, d.y)
    ctx.lineTo(d.x - d.len * WIND, d.y + d.len)
  }
  ctx.stroke()
}

function step() {
  for (const d of drops) {
    d.y += d.speed
    d.x -= d.speed * WIND
    if (d.y > height) { d.y = -d.len; d.x = Math.random() * (width + 60) }
  }
  draw()
  raf = requestAnimationFrame(step)
}

function stop() {
  cancelAnimationFrame(raf)
  raf = 0
}

function start() {
  stop()
  if (!rainy.value || !canvas.value) return
  resize()
  if (reduceMotion) draw() 
  else step()
}

watch(() => [props.weather?.kind, props.weather?.isDay], () => {
  if (canvas.value && !observer) {
    observer = new ResizeObserver(() => { if (rainy.value) start() })
    observer.observe(canvas.value)
  }
  start()
}, { flush: 'post', immediate: true })

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
})
</script>

<template>
  <div v-if="weather" class="ss-scene" :class="`ss-scene--${variant}`"
       :data-weather="weather.kind" :data-time="weather.isDay ? 'day' : 'night'" data-test="weather">
    <div class="ss-scene__sky" aria-hidden="true"></div>
    <div class="ss-scene__art" aria-hidden="true">
      <div class="ss-scene__stars"></div>
      <div class="ss-scene__orb"></div>
      <div v-for="n in 4" :key="'c' + n" class="ss-scene__cloud" :class="`ss-scene__cloud--${n}`"></div>
      <canvas ref="canvas" class="ss-scene__rain"></canvas>
    </div>

    <div class="ss-scene__chip">
      <strong>{{ weather.label }} in {{ area }} · {{ weather.temp }}°C</strong>
      <div class="ss-meta">
        {{ weather.raining
            ? 'Outdoor spots are ranked lower right now.'
            : 'Good conditions for outdoor spots.' }}
      </div>
    </div>
  </div>
</template>

<style scoped>

.ss-scene {
  --k: .7;                      
  --cloud: #fff;
  position: relative; overflow: hidden; isolation: isolate;
  height: 180px;
  border: 1px solid var(--ss-sky-200); border-radius: var(--ss-radius-lg);
}
.ss-scene__art { position: absolute; inset: 0; }

.ss-scene--hero { margin-top: var(--ss-5); max-width: 640px; }
@media (min-width: 768px) {
  /* Sky fills the whole hero; sun, clouds and rain stay on the right */
  .ss-scene--hero {
    --k: 1;
    position: absolute; inset: 0;
    max-width: none; height: auto; margin: 0;
    border: 0; border-radius: 0;
  }
  .ss-scene--hero .ss-scene__art {
    left: auto; width: 58%;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 30%);
            mask-image: linear-gradient(to right, transparent, #000 30%);
  }
  .ss-scene--hero .ss-scene__chip { right: var(--ss-6); bottom: var(--ss-6); }
}

/* ---------- Sky: light on the left (behind the headline), weather colour on the right.
   Many close stops + a soft glow keep the blend smooth with no visible bands. ---------- */
.ss-scene__sky { position: absolute; inset: 0; }
[data-weather="clear"] .ss-scene__sky {
  background:
    radial-gradient(60% 90% at 82% 30%, rgb(249 194 99 / .35), transparent 70%),
    linear-gradient(100deg, var(--ss-sky-50) 0%, var(--ss-amber-50) 35%, var(--ss-amber-100) 65%, var(--ss-amber-200) 100%);
}
[data-weather="partly"] .ss-scene__sky {
  background:
    radial-gradient(55% 80% at 70% 20%, rgb(249 194 99 / .22), transparent 70%),
    linear-gradient(100deg, var(--ss-sky-50) 0%, var(--ss-sky-100) 40%, var(--ss-sky-200) 100%);
}
[data-weather="cloudy"] .ss-scene__sky {
  background: linear-gradient(100deg, var(--ss-ink-50) 0%, var(--ss-ink-50) 25%, var(--ss-ink-100) 60%, var(--ss-ink-200) 100%);
}
[data-weather="rain"] .ss-scene__sky {
  background: linear-gradient(100deg, var(--ss-sky-50) 0%, var(--ss-ink-100) 35%, var(--ss-ink-200) 65%, var(--ss-ink-400) 100%);
}

/* Night skies are dark all the way across; HomeView switches the headline to white */
[data-time="night"]:is([data-weather="clear"], [data-weather="partly"]) .ss-scene__sky {
  background:
    radial-gradient(50% 80% at 80% 25%, rgb(196 170 233 / .25), transparent 70%),
    linear-gradient(100deg, var(--ss-sky-900) 0%, var(--ss-purple-900) 55%, var(--ss-purple-800) 100%);
}
[data-time="night"][data-weather="cloudy"] .ss-scene__sky {
  background: linear-gradient(100deg, var(--ss-ink-900) 0%, var(--ss-ink-800) 45%, var(--ss-ink-700) 100%);
}
[data-time="night"][data-weather="rain"] .ss-scene__sky {
  background: linear-gradient(100deg, var(--ss-ink-900) 0%, var(--ss-ink-900) 35%, var(--ss-ink-800) 100%);
}

.ss-scene__stars {
  position: absolute; inset: 0; opacity: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 22% 24%, #fff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 38% 62%, #fff 50%, transparent 51%),
    radial-gradient(2px 2px at 52% 18%, #fff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 64% 44%, #fff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 76% 72%, #fff 50%, transparent 51%),
    radial-gradient(2px 2px at 88% 30%, #fff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 94% 58%, #fff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 46% 84%, #fff 50%, transparent 51%);
  animation: ss-twinkle 4s ease-in-out infinite alternate;
}
[data-time="night"][data-weather="clear"]  .ss-scene__stars { opacity: 1; }
[data-time="night"][data-weather="partly"] .ss-scene__stars { opacity: .6; }


.ss-scene__orb {
  position: absolute; top: 18%; right: 18%;
  width: calc(110px * var(--k)); aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 40% 38%, var(--ss-amber-100), var(--ss-amber-400) 55%, var(--ss-amber-500));
  box-shadow: 0 0 0 calc(16px * var(--k)) rgb(249 194 99 / .18), 0 0 70px 24px rgb(249 194 99 / .35);
  opacity: 0; transition: opacity .8s, transform .8s;
}
.ss-scene__orb::before {         
  content: ""; position: absolute; inset: calc(-48px * var(--k)); border-radius: 50%;
  background: repeating-conic-gradient(rgb(246 174 48 / .3) 0 6deg, transparent 6deg 18deg);
  -webkit-mask-image: radial-gradient(circle, transparent 50%, #000 52% 66%, transparent 74%);
          mask-image: radial-gradient(circle, transparent 50%, #000 52% 66%, transparent 74%);
  animation: ss-spin 60s linear infinite;
}
[data-weather="clear"]  .ss-scene__orb { opacity: 1; }
[data-weather="partly"] .ss-scene__orb { opacity: 1; transform: translate(-60px, -12px) scale(.72); }

[data-time="night"] .ss-scene__orb {
  width: calc(80px * var(--k));
  background: radial-gradient(circle at 35% 35%, #fff, var(--ss-ink-100) 70%);
  box-shadow: inset calc(-14px * var(--k)) calc(-6px * var(--k)) 0 0 var(--ss-ink-300), 0 0 40px 8px rgb(255 255 255 / .2);
}
[data-time="night"] .ss-scene__orb::before { display: none; }

/* ---------- Clouds ---------- */
[data-weather="cloudy"] { --cloud: var(--ss-ink-50); }
[data-weather="rain"]   { --cloud: var(--ss-ink-300); }
[data-time="night"]                         { --cloud: var(--ss-ink-500); }
[data-time="night"][data-weather="cloudy"]  { --cloud: var(--ss-ink-600); }
[data-time="night"][data-weather="rain"]    { --cloud: var(--ss-ink-700); }

.ss-scene__cloud {
  position: absolute;
  width: calc(var(--w) * var(--k)); height: calc(var(--w) * var(--k) * .32);
  border-radius: 999px; background: var(--cloud);
  filter: drop-shadow(0 8px 14px rgb(18 26 36 / .08));
  opacity: 0; transition: opacity .8s, background-color .8s;
  animation: ss-drift var(--d) ease-in-out infinite alternate;
}
.ss-scene__cloud::before,
.ss-scene__cloud::after { content: ""; position: absolute; background: inherit; border-radius: 50%; }
.ss-scene__cloud::before { width: 50%; aspect-ratio: 1; left: 14%; bottom: 28%; }
.ss-scene__cloud::after  { width: 38%; aspect-ratio: 1; left: 50%; bottom: 20%; }

.ss-scene__cloud--1 { --w: 170px; --d: 14s; top: 26%; right: 8%; }
.ss-scene__cloud--2 { --w: 130px; --d: 18s; top: 52%; right: 36%; }
.ss-scene__cloud--3 { --w: 200px; --d: 22s; top: 10%; right: 32%; }
.ss-scene__cloud--4 { --w: 150px; --d: 16s; top: 62%; right: 4%; }

[data-weather="partly"] :is(.ss-scene__cloud--1, .ss-scene__cloud--2) { opacity: .95; }
:is([data-weather="cloudy"], [data-weather="rain"]) .ss-scene__cloud { opacity: .95; }

/* ---------- Rain (canvas) ---------- */
.ss-scene__rain { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity .8s; }
[data-weather="rain"] .ss-scene__rain { opacity: 1; }

/* ---------- Text chip ---------- */
.ss-scene__chip {
  position: absolute; right: var(--ss-3); bottom: var(--ss-3); z-index: 1;
  max-width: min(340px, calc(100% - 2 * var(--ss-3)));
  padding: var(--ss-3) var(--ss-4);
  background: rgb(255 255 255 / .82); backdrop-filter: blur(8px);
  border: 1px solid rgb(255 255 255 / .9); border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-sm);
  color: var(--ss-ink-900); font-size: var(--ss-text-sm);
}

/* ---------- Motion (stopped by theme.css under prefers-reduced-motion) ---------- */
@keyframes ss-spin       { to { transform: rotate(360deg); } }
@keyframes ss-twinkle    { from { filter: brightness(.6); } to { filter: brightness(1.2); } }
@keyframes ss-drift      { from { translate: -18px 0; } to { translate: 18px 0; } }
</style>
