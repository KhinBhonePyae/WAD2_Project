<script setup>
/* Live weather inside the nav bar. A soft sky behind the nav links
 * (sun glow, drifting clouds, fine rain or a few stars). Sits behind the nav's
 * content, so links stay readable. Remove <NavWeather> from App.vue to undo. */
import { computed } from 'vue'
import { skyOf } from '../utils/weatherPreview.js'

const props = defineProps({ weather: Object, preview: String })
const sky = computed(() => skyOf(props.weather, props.preview))

// small raindrops falling through the nav pill (fixed spread, same every load)
const drops = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 7) % 100,
  length: 8 + (i * 5) % 8,
  duration: 0.45 + ((i * 13) % 30) / 100,
  delay: -((i * 29) % 100) / 100,
}))
</script>

<template>
  <div class="nw" :class="'nw--' + sky" aria-hidden="true" data-test="nav-weather">
    <span v-if="sky === 'clear' || sky === 'cloudy'" class="nw-sun"></span>
    <template v-if="sky !== 'night'">
      <svg class="nw-cloud nw-cloud--a" viewBox="0 0 200 110" aria-hidden="true"><path d="M30 100C10 100 4 78 20 68C14 46 38 32 58 42C66 18 98 10 116 30C128 18 156 22 160 46C182 44 196 64 188 82C184 96 172 100 160 100Z" /></svg>
      <svg class="nw-cloud nw-cloud--b" viewBox="0 0 200 110" aria-hidden="true"><path d="M30 100C10 100 4 78 20 68C14 46 38 32 58 42C66 18 98 10 116 30C128 18 156 22 160 46C182 44 196 64 188 82C184 96 172 100 160 100Z" /></svg>
    </template>
    <span v-if="sky === 'rain'" class="nw-rain">
      <i v-for="(drop, i) in drops" :key="i" class="nw-drop"
        :style="{ left: drop.left + '%', height: drop.length + 'px', animationDuration: drop.duration + 's', animationDelay: drop.delay + 's' }"></i>
    </span>
    <template v-if="sky === 'night'">
      <i v-for="n in 9" :key="n" class="nw-star"
        :style="{ left: (n * 11 + 3) % 100 + '%', top: (n * 37) % 70 + 12 + '%', animationDelay: n % 4 + 's' }"></i>
    </template>
  </div>
</template>

<style scoped>
/* fills the nav pill, behind its links (the nav is its own stacking context) */
.nw {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(90deg, var(--nw-a) 0%, var(--nw-b) 55%, var(--nw-c) 100%);
}
.nw--clear  { --nw-a: rgba(185, 219, 255, .75); --nw-b: rgba(214, 234, 255, .55); --nw-c: rgba(255, 228, 160, .8); }
.nw--cloudy { --nw-a: rgba(195, 205, 219, .8);  --nw-b: rgba(222, 228, 236, .6);  --nw-c: rgba(205, 214, 226, .8); }
.nw--rain   { --nw-a: rgba(169, 185, 204, .85); --nw-b: rgba(196, 207, 220, .65); --nw-c: rgba(169, 185, 204, .85); }
.nw--night  { --nw-a: rgba(150, 140, 210, .8);  --nw-b: rgba(185, 178, 232, .6);  --nw-c: rgba(120, 110, 190, .85); }

.nw-sun {
  position: absolute;
  top: -60px;
  right: 8%;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 190, 60, .85) 0%, rgba(255, 205, 90, .35) 40%, transparent 68%);
  animation: nw-glow 8s ease-in-out infinite alternate;
}
.nw--cloudy .nw-sun { opacity: .45; }

.nw-cloud {
  position: absolute;
  aspect-ratio: 200 / 110;
  fill: rgba(255, 255, 255, .92);
  filter: blur(.5px);
  animation: nw-drift 40s linear infinite alternate;
}
.nw-cloud--a { top: 4px; left: 18%; width: 64px; }
.nw-cloud--b { bottom: -6px; left: 52%; width: 80px; opacity: .75; animation-duration: 55s; animation-delay: -20s; }
.nw--clear .nw-cloud { opacity: .5; }
.nw--rain .nw-cloud { fill: rgba(225, 231, 240, .92); }

.nw-rain {
  position: absolute;
  inset: 0;
}

.nw-drop {
  position: absolute;
  top: -16px;
  width: 1px;
  background: linear-gradient(180deg, rgba(60, 82, 118, 0), rgba(60, 82, 118, .45));
  rotate: 8deg;
  animation: nw-fall linear infinite;
}

.nw-star {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 6px 1px #fff;
  animation: nw-twinkle 3.5s ease-in-out infinite;
}

@keyframes nw-glow { from { transform: scale(1); } to { transform: scale(1.12); } }
@keyframes nw-drift { from { transform: translateX(-40px); } to { transform: translateX(60px); } }
@keyframes nw-fall { from { translate: 0 0; } to { translate: -12px 90px; } }
@keyframes nw-twinkle { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .nw-sun, .nw-cloud, .nw-drop, .nw-star { animation: none; }
}
</style>
