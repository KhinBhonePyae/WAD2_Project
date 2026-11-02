<script setup>
/* Quiet weather background for the Browse page: a soft tint at the top of the
 * page plus slow clouds, a sun glow, faint rain or a few stars, depending on
 * the live weather. Kept faint on purpose so the listings stay easy to read.
 * To go back to the old weather card, swap this for <WeatherScene compact>. */
import { computed } from 'vue'

const props = defineProps({ weather: Object })

// clear | cloudy | rain | night (same mapping as WeatherScene)
const sky = computed(() => {
  const w = props.weather
  if (!w) return 'clear'
  if (w.kind === 'rain') return 'rain'
  if (!w.isDay) return 'night'
  return w.kind === 'clear' ? 'clear' : 'cloudy'
})
</script>

<template>
  <div class="wb" :class="'wb--' + sky" aria-hidden="true" data-test="weather-backdrop">
    <div class="wb-tint"></div>
    <div v-if="sky === 'clear' || sky === 'cloudy'" class="wb-sun"></div>
    <div v-if="sky !== 'night'" class="wb-clouds">
      <span class="wb-cloud wb-cloud--a"></span>
      <span class="wb-cloud wb-cloud--b"></span>
      <span class="wb-cloud wb-cloud--c"></span>
    </div>
    <div v-if="sky === 'rain'" class="wb-rain"></div>
    <div v-if="sky === 'night'" class="wb-stars">
      <i v-for="n in 14" :key="n" :style="{ '--x': (n * 37) % 100 + '%', '--y': (n * 53) % 45 + '%', '--d': (n % 5) + 's' }"></i>
    </div>
  </div>
</template>

<style scoped>
.wb {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Colour wash that fades out before the listings start */
.wb-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, var(--wb-sky) 0%, transparent 70%);
  opacity: .55;
}
.wb--clear  { --wb-sky: #cfe6ff; --wb-cloud: rgba(255, 255, 255, .9); }
.wb--cloudy { --wb-sky: #d9dfe8; --wb-cloud: rgba(255, 255, 255, .85); }
.wb--rain   { --wb-sky: #c4cfdc; --wb-cloud: rgba(214, 221, 231, .9); }
.wb--night  { --wb-sky: #c9c6e8; }

.wb-sun {
  position: absolute;
  top: -120px;
  right: -60px;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 214, 102, .55) 0%, rgba(255, 214, 102, 0) 65%);
  animation: wb-glow 9s ease-in-out infinite alternate;
}
.wb--cloudy .wb-sun { opacity: .45; }

.wb-cloud {
  position: absolute;
  height: 120px;
  border-radius: 999px;
  background: var(--wb-cloud);
  filter: blur(18px);
  opacity: .7;
  animation: wb-drift 90s linear infinite alternate;
}
.wb-cloud--a { top: 70px; left: -10%; width: 420px; }
.wb-cloud--b { top: 190px; left: 45%; width: 520px; height: 140px; animation-duration: 120s; animation-delay: -40s; }
.wb-cloud--c { top: 330px; left: 10%; width: 360px; height: 100px; opacity: .45; animation-duration: 100s; animation-delay: -70s; }
.wb--clear .wb-cloud { opacity: .35; }

/* Fine diagonal streaks, faded towards the bottom */
.wb-rain {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(105deg, rgba(70, 90, 120, .22) 0 1px, transparent 1px 14px);
  background-size: 200px 200px;
  mask-image: linear-gradient(180deg, #000 0%, transparent 65%);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 65%);
  opacity: .5;
  animation: wb-rain 2.4s linear infinite;
}

.wb-stars i {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, .9);
  animation: wb-twinkle 4s ease-in-out var(--d) infinite;
}

@keyframes wb-drift { from { transform: translateX(-8vw); } to { transform: translateX(12vw); } }
@keyframes wb-glow { from { transform: scale(1); } to { transform: scale(1.08); } }
@keyframes wb-rain { from { background-position: 0 0; } to { background-position: -40px 200px; } }
@keyframes wb-twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }

@media (max-width: 768px) {
  .wb-sun { width: 280px; height: 280px; top: -90px; right: -80px; }
  .wb-cloud--b { left: 30%; width: 380px; }
}

@media (prefers-reduced-motion: reduce) {
  .wb-sun, .wb-cloud, .wb-rain, .wb-stars i { animation: none; }
}
</style>
