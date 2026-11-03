<script setup>
/* Quiet weather background for the Browse page: a soft tint at the top of the
 * page plus slow clouds, a sun glow, faint rain or a few stars, depending on
 * the live weather. Kept faint on purpose so the listings stay easy to read.
 * To go back to the old weather card, swap this for <WeatherScene compact>. */
import { computed } from 'vue'
import { skyOf } from '../utils/weatherPreview.js'

// preview: force a sky for testing ('clear' | 'cloudy' | 'rain' | 'night'); empty = live
const props = defineProps({ weather: Object, preview: String })
const sky = computed(() => skyOf(props.weather, props.preview))

/* Raindrops in two layers: far drops are thin, short, faint and slower; near
 * drops are longer, crisper and faster. Positions and timings are spread with
 * fixed number patterns (not Math.random) so the rain looks the same each load. */
const drops = Array.from({ length: 56 }, (_, i) => {
  const near = i % 3 === 0
  return {
    near,
    left: (i * 37 + 11) % 100,
    length: near ? 34 + (i * 7) % 22 : 16 + (i * 5) % 12,
    duration: near ? 0.55 + ((i * 13) % 20) / 100 : 0.95 + ((i * 17) % 35) / 100,
    delay: -((i * 29) % 100) / 50,
  }
})
</script>

<template>
  <div class="wb" :class="'wb--' + sky" aria-hidden="true" data-test="weather-backdrop">
    <div class="wb-tint"></div>
    <div v-if="sky === 'clear' || sky === 'cloudy'" class="wb-sun"></div>
    <div v-if="sky !== 'night'" class="wb-clouds">
      <svg class="wb-cloud wb-cloud--a" viewBox="0 0 200 110" aria-hidden="true"><path d="M30 100C10 100 4 78 20 68C14 46 38 32 58 42C66 18 98 10 116 30C128 18 156 22 160 46C182 44 196 64 188 82C184 96 172 100 160 100Z" /></svg>
      <svg class="wb-cloud wb-cloud--b" viewBox="0 0 200 110" aria-hidden="true"><path d="M30 100C10 100 4 78 20 68C14 46 38 32 58 42C66 18 98 10 116 30C128 18 156 22 160 46C182 44 196 64 188 82C184 96 172 100 160 100Z" /></svg>
      <svg class="wb-cloud wb-cloud--c" viewBox="0 0 200 110" aria-hidden="true"><path d="M30 100C10 100 4 78 20 68C14 46 38 32 58 42C66 18 98 10 116 30C128 18 156 22 160 46C182 44 196 64 188 82C184 96 172 100 160 100Z" /></svg>
    </div>
    <div v-if="sky === 'rain'" class="wb-rain">
      <i v-for="(drop, i) in drops" :key="i" class="wb-drop" :class="{ 'wb-drop--near': drop.near }"
        :style="{ left: drop.left + '%', height: drop.length + 'px', animationDuration: drop.duration + 's', animationDelay: drop.delay + 's' }"></i>
    </div>
    <div v-if="sky === 'night'" class="wb-stars">
      <i v-for="n in 14" :key="n" :style="{ '--x': (n * 37) % 100 + '%', '--y': (n * 53) % 45 * 12 + 'px', '--d': (n % 5) + 's' }"></i>
    </div>
  </div>
</template>

<style scoped>
/* Covers the whole Browse page and scrolls with it (the page wrapper is
 * position: relative), so the sky sits behind the header and fades out
 * gently down the listings */
.wb {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Colour wash over the whole page: full strength behind the header, then
 * eased steps down the page, melting into the plain background at the very bottom */
.wb-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    var(--wb-sky) 0,
    var(--wb-sky) 180px,
    color-mix(in srgb, var(--wb-sky) 82%, transparent) 420px,
    color-mix(in srgb, var(--wb-sky) 60%, transparent) 800px,
    color-mix(in srgb, var(--wb-sky) 42%, transparent) 1300px,
    color-mix(in srgb, var(--wb-sky) 28%, transparent) calc(100% - 420px),
    transparent 100%);
  opacity: .9;
}
.wb--clear  { --wb-sky: #b9dbff; --wb-cloud: rgba(255, 255, 255, .95); }
.wb--cloudy { --wb-sky: #c3cddb; --wb-cloud: rgba(255, 255, 255, .9); }
.wb--rain   { --wb-sky: #a9b9cc; --wb-cloud: rgba(205, 214, 226, .95); }
.wb--night  { --wb-sky: #b3acdf; }

.wb-sun {
  position: absolute;
  top: -120px;
  right: -60px;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 196, 64, .8) 0%, rgba(255, 210, 100, .35) 35%, rgba(255, 214, 102, 0) 66%);
  animation: wb-glow 9s ease-in-out infinite alternate;
}
.wb--cloudy .wb-sun { opacity: .5; }

/* puffy cloud silhouette (SVG path), slightly softened at the edges */
.wb-cloud {
  position: absolute;
  aspect-ratio: 200 / 110;
  fill: var(--wb-cloud);
  filter: blur(1.5px) drop-shadow(0 6px 10px rgba(80, 100, 130, .12));
  opacity: .9;
  animation: wb-drift 90s linear infinite alternate;
}
.wb-cloud--a { top: 60px; left: -4%; width: 300px; }
.wb-cloud--b { top: 170px; left: 45%; width: 360px; animation-duration: 120s; animation-delay: -40s; }
.wb-cloud--c { top: 330px; left: 12%; width: 220px; opacity: .55; animation-duration: 100s; animation-delay: -70s; }
.wb--clear .wb-cloud { opacity: .55; }

/* Falling rain behind the header, fading out before the listings */
.wb-rain {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 640px;
  overflow: hidden;
  mask-image: linear-gradient(180deg, #000 0, #000 200px, transparent 640px);
  -webkit-mask-image: linear-gradient(180deg, #000 0, #000 200px, transparent 640px);
}

/* one raindrop: a thin streak, clear at the tail and darker at the head,
 * tilted to match the slight sideways fall */
.wb-drop {
  position: absolute;
  top: -60px;
  width: 1px;
  border-radius: 0 0 1px 1px;
  background: linear-gradient(180deg, rgba(70, 92, 125, 0), rgba(70, 92, 125, .42));
  rotate: 8deg;
  animation: wb-fall linear infinite;
}
.wb-drop--near {
  width: 1.6px;
  background: linear-gradient(180deg, rgba(60, 82, 118, 0), rgba(60, 82, 118, .6));
}

.wb-stars i {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 8px 1px rgba(255, 255, 255, 1);
  animation: wb-twinkle 4s ease-in-out var(--d) infinite;
}

@keyframes wb-drift { from { transform: translateX(-8vw); } to { transform: translateX(12vw); } }
@keyframes wb-glow { from { transform: scale(1); } to { transform: scale(1.08); } }
@keyframes wb-fall { from { translate: 0 0; } to { translate: -100px 720px; } }
@keyframes wb-twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }

@media (max-width: 768px) {
  .wb-sun { width: 280px; height: 280px; top: -90px; right: -80px; }
  .wb-cloud--b { left: 30%; width: 240px; }
}

@media (prefers-reduced-motion: reduce) {
  .wb-sun, .wb-cloud, .wb-drop, .wb-stars i { animation: none; }
}
</style>
