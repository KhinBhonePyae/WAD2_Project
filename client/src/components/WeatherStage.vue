<script setup>
/* Live weather scene (Design 2).
 * Sky + sun/moon + drifting clouds + a canvas particle layer:
 *   rain  -> streaks and splashes; the cursor is an umbrella that pushes drops away
 *   night -> twinkling stars and the odd shooting star
 *   clear -> slow floating dust motes in the sunlight
 * A dial lets people preview other conditions; "Live" goes back to Open-Meteo. */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { gsap, reducedMotion } from '../utils/motion.js'

const props = defineProps({ weather: Object, area: String, compact: Boolean })

const MODES = [
  { key: 'live', label: 'Live' },
  { key: 'clear', label: 'Sunny' },
  { key: 'cloudy', label: 'Cloudy' },
  { key: 'rain', label: 'Rain' },
  { key: 'night', label: 'Night' },
]

/* Weather-specific cloud compositions.
   Sizes are percentages, positions are carefully staggered to avoid 
   the sun, the moon, and the UI cards at the bottom.
   Opacity is fully 1 for day scenes so the sun doesn't bleed through.
   Opacity is lowered for night to give a translucent effect. */
const CLOUD_SCENES = {
  clear: [
    { size: 13, left: 10, top: 5, opacity: 1, dur: 40, drift: 8, delay: 0, bob: 3 },
    // Safely moved to center-left (left: 35) and made opaque
    { size: 16, left: 35, top: 30, opacity: 1, dur: 35, drift: -10, delay: -5, bob: 4 }
  ],
  cloudy: [
    { size: 20, left: 5, top: 2, opacity: 1, dur: 32, drift: 12, delay: 0, bob: 5 },
    { size: 16, left: 30, top: 20, opacity: 1, dur: 28, drift: -8, delay: -10, bob: 4 },
    { size: 22, left: 60, top: 35, opacity: 1, dur: 36, drift: 10, delay: -5, bob: 6 }
  ],
  rain: [
    // Staggered in a 3-top, 2-bottom formation so they don't overlap vertically
    { size: 24, left: 5, top: -2, opacity: 0.95, dur: 30, drift: 10, delay: 0, bob: 5 },
    { size: 22, left: 35, top: -5, opacity: 0.9, dur: 35, drift: -12, delay: -10, bob: 6 },
    { size: 26, left: 70, top: -2, opacity: 0.95, dur: 28, drift: 8, delay: -5, bob: 4 },
    { size: 18, left: 15, top: 28, opacity: 0.85, dur: 40, drift: -10, delay: -15, bob: 7 },
    { size: 20, left: 50, top: 30, opacity: 0.9, dur: 32, drift: 12, delay: -8, bob: 5 }
  ],
  night: [
    // Translucent night clouds
    { size: 28, left: 6, top: 5, opacity: 0.55, dur: 30, drift: 15, delay: 0, bob: 7 },
    { size: 26, left: 55, top: 40, opacity: 0.65, dur: 34, drift: -12, delay: -8, bob: 6 }
  ]
}

const modeIndex = ref(0)
const mode = computed(() => MODES[modeIndex.value].key)

// What the scene shows: the live weather, or the previewed preset
const scene = computed(() => {
  const w = props.weather
  if (mode.value === 'live') {
    if (!w) return { kind: 'clear', night: false, storm: false }
    return { kind: w.kind === 'partly' ? 'clear' : w.kind, night: !w.isDay, storm: w.code >= 95 }
  }
  if (mode.value === 'night') return { kind: 'clear', night: true, storm: false }
  return { kind: mode.value, night: false, storm: false }
})

const skyKey = computed(() => (scene.value.night ? 'night' : scene.value.kind))
const activeClouds = computed(() => CLOUD_SCENES[skyKey.value] || CLOUD_SCENES.clear)

const tempShown = ref(0)
const label = computed(() => {
  if (mode.value !== 'live') return MODES[modeIndex.value].label + ' (preview)'
  return props.weather?.label || 'Checking the sky…'
})
const advice = computed(() => {
  if (scene.value.kind === 'rain') return 'Raining, so indoor spots rank higher right now.'
  if (scene.value.night) return 'Night owl hours: most libraries close at 9pm.'
  if (scene.value.kind === 'cloudy') return 'Overcast and cooler: terraces are fair game.'
  return 'Good conditions for outdoor spots.'
})

const root = ref(null)
const canvas = ref(null)
const dial = ref(null)
let ctx2d = null, raf = 0, w = 0, h = 0, visible = true, observer = null
let particles = [], splashes = [], shooting = null
let mouse = { x: -999, y: -999 }
let gctx = null, sunX = null, sunY = null, cloudsX = null
let cloudTweens = []

/* ---------- particles ---------- */
function makeParticles() {
  const kind = skyKey.value
  const area = w * h
  particles = []
  if (kind === 'rain') {
    const n = Math.round(area / 2600)
    for (let i = 0; i < n; i++) particles.push({
      x: Math.random() * w, y: Math.random() * h,
      len: 10 + Math.random() * 14, v: 9 + Math.random() * 7
    })
  } else if (kind === 'night') {
    const n = Math.round(area / 5200)
    for (let i = 0; i < n; i++) particles.push({
      x: Math.random() * w, y: Math.random() * h * 0.8,
      r: Math.random() * 1.4 + 0.3, t: Math.random() * Math.PI * 2, s: 0.01 + Math.random() * 0.03
    })
  } else {
    const n = Math.round(area / 16000)
    for (let i = 0; i < n; i++) particles.push({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 2.2 + 0.6, vx: (Math.random() - 0.5) * 0.25, vy: -0.1 - Math.random() * 0.25,
      a: Math.random() * 0.5 + 0.2
    })
  }
}

function frame() {
  raf = requestAnimationFrame(frame)
  if (!visible || !ctx2d) return
  ctx2d.clearRect(0, 0, w, h)
  const kind = skyKey.value

  if (kind === 'rain') {
    ctx2d.strokeStyle = 'rgba(232, 242, 255, .7)'
    ctx2d.lineWidth = 1.3
    ctx2d.beginPath()
    for (const p of particles) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y
      const dist = Math.hypot(dx, dy)
      if (dist < 90 && dy < 0) p.x += (dx >= 0 ? 1 : -1) * (90 - dist) * 0.12
      p.y += p.v; p.x += p.v * 0.18
      if (p.y > h) {
        if (Math.random() < 0.35) splashes.push({ x: p.x, y: h - 2, r: 1, a: 0.8 })
        p.y = -p.len; p.x = Math.random() * w * 1.1 - w * 0.1
      }
      ctx2d.moveTo(p.x, p.y)
      ctx2d.lineTo(p.x - p.len * 0.18, p.y - p.len)
    }
    ctx2d.stroke()
    for (const s of splashes) {
      s.r += 0.8; s.a -= 0.04
      ctx2d.strokeStyle = `rgba(232, 242, 255, ${Math.max(s.a, 0)})`
      ctx2d.beginPath(); ctx2d.ellipse(s.x, s.y, s.r * 2, s.r * 0.6, 0, 0, Math.PI * 2); ctx2d.stroke()
    }
    splashes = splashes.filter(s => s.a > 0)
  } else if (kind === 'night') {
    for (const p of particles) {
      p.t += p.s
      const a = 0.35 + Math.sin(p.t) * 0.35 + 0.3
      ctx2d.fillStyle = `rgba(255, 250, 230, ${a})`
      ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx2d.fill()
    }
    if (!shooting && Math.random() < 0.004) {
      shooting = { x: Math.random() * w * 0.6 + w * 0.3, y: Math.random() * h * 0.3, life: 1 }
    }
    if (shooting) {
      const s = shooting
      const g = ctx2d.createLinearGradient(s.x, s.y, s.x + 90, s.y - 40)
      g.addColorStop(0, `rgba(255,255,255,${s.life})`); g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx2d.strokeStyle = g; ctx2d.lineWidth = 2
      ctx2d.beginPath(); ctx2d.moveTo(s.x, s.y); ctx2d.lineTo(s.x + 90, s.y - 40); ctx2d.stroke()
      s.x -= 9; s.y += 4; s.life -= 0.025
      if (s.life <= 0) shooting = null
    }
  } else {
    for (const p of particles) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y
      const dist = Math.hypot(dx, dy)
      if (dist < 70) { p.x += dx / dist * 1.4; p.y += dy / dist * 1.4 }
      p.x += p.vx; p.y += p.vy
      if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w }
      ctx2d.fillStyle = `rgba(255, 246, 214, ${p.a})`
      ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx2d.fill()
    }
  }
}

function resize() {
  if (!canvas.value) return
  const box = canvas.value.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = box.width; h = box.height
  canvas.value.width = w * dpr; canvas.value.height = h * dpr
  ctx2d = canvas.value.getContext('2d')
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  makeParticles()
}

function onPointer(e) {
  const box = root.value.getBoundingClientRect()
  mouse = { x: e.clientX - box.left, y: e.clientY - box.top }
  if (sunX) {
    sunX((mouse.x / box.width - 0.5) * 40)
    sunY((mouse.y / box.height - 0.5) * 24)
    cloudsX((mouse.x / box.width - 0.5) * -30)
  }
}
function onLeave() { mouse = { x: -999, y: -999 } }

/* ---------- dial: drag, click or arrow keys ---------- */
const STEP = 360 / MODES.length
const dialAngle = computed(() => modeIndex.value * STEP)
let dragging = false

function angleFromEvent(e) {
  const box = dial.value.getBoundingClientRect()
  const a = Math.atan2(e.clientY - (box.top + box.height / 2), e.clientX - (box.left + box.width / 2)) * 180 / Math.PI + 90
  return (a + 360) % 360
}
function setFromAngle(a) {
  modeIndex.value = Math.round(a / STEP) % MODES.length
}
function dialDown(e) { dragging = true; dial.value.setPointerCapture(e.pointerId); setFromAngle(angleFromEvent(e)) }
function dialMove(e) { if (dragging) setFromAngle(angleFromEvent(e)) }
function dialUp() { dragging = false }
function dialKey(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { modeIndex.value = (modeIndex.value + 1) % MODES.length; e.preventDefault() }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { modeIndex.value = (modeIndex.value + MODES.length - 1) % MODES.length; e.preventDefault() }
}

/* ---------- reactions ---------- */
function countTemp() {
  const target = props.weather?.temp ?? 0
  const preset = { clear: 33, cloudy: 29, rain: 26, night: 27 }[mode.value]
  const to = mode.value === 'live' ? target : preset
  if (reducedMotion) { tempShown.value = to; return }
  const obj = { v: tempShown.value }
  gsap.to(obj, { v: to, duration: 1.2, ease: 'power3.out', onUpdate: () => { tempShown.value = Math.round(obj.v) } })
}

let flashTimer = null
function scheduleLightning() {
  clearTimeout(flashTimer)
  if (!scene.value.storm || reducedMotion) return
  flashTimer = setTimeout(() => {
    gsap.fromTo(root.value.querySelector('.ws-flash'), { opacity: 0.85 }, { opacity: 0, duration: 0.6, ease: 'power2.out' })
    scheduleLightning()
  }, 4000 + Math.random() * 6000)
}

function initClouds() {
  cloudTweens.forEach(t => t.kill())
  cloudTweens = []
  if (reducedMotion || !root.value) return
  
  gsap.utils.toArray('.ws-cloud').forEach((c, i) => {
    const cfg = activeClouds.value[i]
    if (!cfg) return
    cloudTweens.push(
      gsap.fromTo(c, { xPercent: -cfg.drift }, {
        xPercent: cfg.drift, duration: cfg.dur, ease: 'sine.inOut',
        yoyo: true, repeat: -1, delay: cfg.delay
      }),
      gsap.to(c, {
        y: cfg.bob, duration: cfg.dur * 0.45, ease: 'sine.inOut',
        yoyo: true, repeat: -1, delay: cfg.delay
      })
    )
  })
}

watch(skyKey, () => { 
  makeParticles(); 
  splashes = [];
  nextTick(() => { initClouds(); })
})
watch(() => [props.weather, mode.value], () => { countTemp(); scheduleLightning() })

onMounted(() => {
  resize()
  countTemp()
  scheduleLightning()
  window.addEventListener('resize', resize)
  
  if (!reducedMotion) {
    raf = requestAnimationFrame(frame)
    gctx = gsap.context(() => {
      sunX = gsap.quickTo('.ws-sun', 'x', { duration: 1.2, ease: 'power3' })
      sunY = gsap.quickTo('.ws-sun', 'y', { duration: 1.2, ease: 'power3' })
      cloudsX = gsap.quickTo('.ws-clouds', 'x', { duration: 1.6, ease: 'power3' })
    }, root.value)
    initClouds()
  }
  
  observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
  observer.observe(root.value)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  clearTimeout(flashTimer)
  window.removeEventListener('resize', resize)
  cloudTweens.forEach(t => t.kill())
  observer?.disconnect()
  gctx?.revert()
})
</script>

<template>
  <section ref="root" class="ws" :class="['ws--' + skyKey, { 'ws--compact': compact }]" data-test="weather"
    @pointermove="onPointer" @pointerleave="onLeave">
    <div class="ws-sky ws-sky--clear"></div>
    <div class="ws-sky ws-sky--cloudy"></div>
    <div class="ws-sky ws-sky--rain"></div>
    <div class="ws-sky ws-sky--night"></div>

    <div class="ws-sun" aria-hidden="true">
      <span class="ws-sun__rays"></span>
      <span class="ws-sun__disc"></span>
    </div>

    <div class="ws-clouds" aria-hidden="true">
      <!-- shared gradients: soft daylight body, cooler storm body, deep night body -->
      <svg class="ws-cloud-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="ws-cloud-g-day" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#FFFFFF" />
            <stop offset=".6" stop-color="#FBF8F0" />
            <stop offset="1" stop-color="#E2EAF2" />
          </linearGradient>
          <linearGradient id="ws-cloud-g-rain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#D8E0E8" />
            <stop offset="1" stop-color="#AEBAC6" />
          </linearGradient>
          <!-- Night gradient made slightly translucent -->
          <linearGradient id="ws-cloud-g-night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#5A548C" stop-opacity="0.85" />
            <stop offset="1" stop-color="#36326A" stop-opacity="0.6" />
          </linearGradient>
        </defs>
      </svg>

      <svg v-for="(c, i) in activeClouds" :key="skyKey + i" class="ws-cloud"
        :style="{ '--w': c.size + '%', left: c.left + '%', top: c.top + '%', opacity: c.opacity }"
        viewBox="-4 -30 208 116">
        <path class="ws-cloud__body"
          d="M30 80a28 28 0 0 1 4-55 40 40 0 0 1 74-12 32 32 0 0 1 54 18 26 26 0 0 1 8 49z" />
      </svg>
    </div>

    <canvas ref="canvas" class="ws-canvas" aria-hidden="true"></canvas>
    <div class="ws-flash" aria-hidden="true"></div>

    <div class="ws-card">
      <div class="ws-card__temp"><span>{{ tempShown }}</span><sup>°C</sup></div>
      <div>
        <div class="ws-card__label">{{ label }} <span v-if="area" class="ws-card__area">· {{ area }}</span></div>
        <div class="ws-card__advice">{{ advice }}</div>
      </div>
    </div>

    <div class="ws-dial-wrap">
      <div ref="dial" class="ws-dial" role="slider" tabindex="0" data-cursor="spin" aria-label="Preview weather"
        :aria-valuetext="MODES[modeIndex].label" :aria-valuenow="modeIndex" aria-valuemin="0"
        :aria-valuemax="MODES.length - 1" @pointerdown="dialDown" @pointermove="dialMove" @pointerup="dialUp"
        @keydown="dialKey">
        <span class="ws-dial__knob" :style="{ transform: `rotate(${dialAngle}deg)` }"><i></i></span>
        <span v-for="(m, i) in MODES" :key="m.key" class="ws-dial__tick"
          :class="{ 'ws-dial__tick--on': i === modeIndex }"
          :style="{ transform: `rotate(${i * STEP}deg) translateY(-50px) rotate(${-i * STEP}deg)` }"
          @click.stop="modeIndex = i">{{ m.label }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ws {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  height: clamp(340px, 46vw, 460px);
  border: var(--x-line);
  border-radius: 28px;
  box-shadow: var(--x-pop-lg);
  touch-action: pan-y;
  container-type: inline-size;
}

.ws--compact {
  height: 280px;
  border-radius: 24px;
}

.ws-sky {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 1s ease;
  z-index: -3;
}

.ws-sky--clear {
  background: linear-gradient(180deg, #7FC8FF 0%, #BFE6FF 55%, #FFF0C2 100%);
}

.ws-sky--cloudy {
  background: linear-gradient(180deg, #A9B8C6 0%, #D7DEE4 60%, #EEF0EE 100%);
}

.ws-sky--rain {
  background: linear-gradient(180deg, #4F6275 0%, #7D90A3 60%, #A3B2BF 100%);
}

.ws-sky--night {
  background: linear-gradient(180deg, #0E1330 0%, #26245A 60%, #4B3F7A 100%);
}

.ws--clear .ws-sky--clear,
.ws--cloudy .ws-sky--cloudy,
.ws--rain .ws-sky--rain,
.ws--night .ws-sky--night {
  opacity: 1;
}

/* sun becomes the moon at night */
.ws-sun {
  position: absolute;
  right: 18%;
  top: 14%;
  width: 120px;
  height: 120px;
  z-index: -2;
  transition: opacity .8s, filter .8s;
}

.ws-sun__disc {
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  background: #FFD84A;
  border: 2px solid var(--x-ink);
  box-shadow: 0 0 60px 16px rgba(255, 216, 74, .55);
  transition: background-color .8s, box-shadow .8s;
}

.ws-sun__rays {
  position: absolute;
  inset: -18px;
  border-radius: 50%;
  /* 22.5deg ensures perfect division of 360 degrees (no glitchy overlapping ray) */
  background: repeating-conic-gradient(rgba(255, 216, 74, .55) 0 6deg, transparent 6deg 22.5deg);
  -webkit-mask: radial-gradient(circle, transparent 46%, #000 47%, #000 66%, transparent 67%);
  mask: radial-gradient(circle, transparent 46%, #000 47%, #000 66%, transparent 67%);
  animation: ws-spin 30s linear infinite;
}

.ws--night .ws-sun__disc {
  background: #F4F0DC;
  box-shadow: 0 0 50px 10px rgba(244, 240, 220, .25), inset -14px -6px 0 rgba(0, 0, 0, .12);
}

.ws--night .ws-sun__rays,
.ws--rain .ws-sun__rays,
.ws--cloudy .ws-sun__rays {
  opacity: 0;
}

.ws--rain .ws-sun {
  opacity: 0; /* Sun completely disappears in rain */
}

.ws--cloudy .ws-sun {
  opacity: .3;
  filter: blur(2px);
}

@keyframes ws-spin {
  to {
    transform: rotate(360deg);
  }
}

.ws-clouds {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.ws-cloud-defs {
  position: absolute;
  width: 0;
  height: 0;
}

.ws-cloud {
  position: absolute;
  overflow: visible;
  width: clamp(70px, var(--w, 20%), 230px);
  stroke: var(--x-ink);
  stroke-width: 3;
  stroke-linejoin: round;
  filter: drop-shadow(0 8px 14px rgba(22, 30, 46, .1));
  transition: opacity 1s, stroke 1s, fill 1s;
  will-change: transform;
}

.ws-cloud__body {
  fill: url(#ws-cloud-g-day);
  transition: fill 1s;
}

.ws--rain .ws-cloud__body {
  fill: url(#ws-cloud-g-rain);
}

.ws--night .ws-cloud__body {
  fill: url(#ws-cloud-g-night);
}

.ws--night .ws-cloud {
  stroke: #0E1330;
}

.ws-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.ws-flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
  z-index: 2;
}

.ws-card {
  position: absolute;
  left: 20px;
  bottom: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: calc(100% - 180px);
  padding: 12px 18px 12px 14px;
  background: var(--x-card);
  border: var(--x-line);
  border-radius: 20px;
  box-shadow: var(--x-pop);
  z-index: 10;
}

.ws-card__temp {
  font-weight: 800;
  font-size: 3rem;
  line-height: .9;
  letter-spacing: -.05em;
  color: var(--x-ink);
}

.ws-card__temp sup {
  font-size: 1rem;
  top: -1.4em;
  margin-left: 2px;
}

.ws-card__label {
  font-weight: 700;
  color: var(--x-ink);
}

.ws-card__area {
  font-weight: 400;
  color: var(--x-muted);
}

.ws-card__advice {
  font-size: .88rem;
  color: var(--x-muted);
}

.ws-dial-wrap {
  position: absolute;
  right: 22px;
  bottom: 22px;
  z-index: 10;
}

.ws-dial {
  position: relative;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 253, 248, .55);
  backdrop-filter: blur(6px);
  border: var(--x-line);
  touch-action: none;
  user-select: none;
}

.ws-dial:focus-visible {
  outline: 3px solid var(--x-orange);
  outline-offset: 3px;
}

.ws-dial__knob {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--x-orange);
  border: var(--x-line);
  box-shadow: 3px 3px 0 var(--x-ink);
  display: block;
  position: relative;
  transition: transform .45s var(--x-ease);
}

.ws-dial__knob i {
  position: absolute;
  left: 50%;
  top: 5px;
  width: 4px;
  height: 14px;
  margin-left: -2px;
  border-radius: 2px;
  background: var(--x-ink);
}

.ws-dial__tick {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  font-family: var(--x-mono);
  font-size: .56rem;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--x-ink);
  padding: 1px 4px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.ws-dial__tick--on {
  background: var(--x-ink);
  color: var(--x-lime);
}

/* narrow spots (e.g. the detail page sidebar): dial tucks into the corner */
@container (max-width: 560px) {
  .ws-card {
    left: 12px;
    right: 12px;
    bottom: 12px;
    max-width: none;
  }

  .ws-card__temp {
    font-size: 2.4rem;
  }

  .ws-dial-wrap {
    right: 6px;
    bottom: auto;
    top: 6px;
    transform: scale(.72);
    transform-origin: top right;
  }
}

@media (max-width: 575.98px) {
  .ws {
    height: 420px;
  }

  .ws-card {
    left: 12px;
    right: 12px;
    bottom: 12px;
    max-width: none;
  }

  .ws-card__temp {
    font-size: 2.4rem;
  }

  .ws-dial-wrap {
    right: 50%;
    bottom: auto;
    top: 16px;
    transform: translateX(50%) scale(.85);
  }

  .ws-sun {
    right: 8%;
    top: 40%;
    width: 90px;
    height: 90px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ws-sun__rays {
    animation: none;
  }

  .ws-dial__knob,
  .ws-sky {
    transition: none;
  }
}
</style>