<script setup>
/* Place card (Design 2): tilts towards the cursor with a moving shine,
 * the photo parallaxes inside its frame, and saving fires a little burst. */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import SuitabilityScore from './SuitabilityScore.vue'
import StarRating from './StarRating.vue'
import { LEVEL_LABELS } from '../utils/intents.js'
import { gsap, finePointer, reducedMotion } from '../utils/motion.js'

const props = defineProps({ place: Object, score: Number, saved: Boolean })
const emit = defineEmits(['toggle-save'])

const card = ref(null)
const burst = ref(null)
const ACCENTS = ['var(--x-orange)', 'var(--x-lime)', 'var(--x-lilac)', 'var(--x-sky)', 'var(--x-butter)', 'var(--x-pink)']
const accent = computed(() => ACCENTS[(props.place.id || 0) % ACCENTS.length])
const interactive = finePointer && !reducedMotion
let rx, ry, ix, iy, ctx

function onMove(e) {
  if (!interactive || !rx) return
  const box = card.value.getBoundingClientRect()
  const nx = (e.clientX - box.left) / box.width - 0.5
  const ny = (e.clientY - box.top) / box.height - 0.5
  ry(nx * 14); rx(-ny * 12)
  ix(nx * -18); iy(ny * -14)
  card.value.style.setProperty('--shine-x', (nx + 0.5) * 100 + '%')
  card.value.style.setProperty('--shine-y', (ny + 0.5) * 100 + '%')
}
function onLeave() {
  if (!interactive || !rx) return
  ry(0); rx(0); ix(0); iy(0)
}

function toggleSave() {
  if (!props.saved && !reducedMotion) {
    // confetti-ish burst of little dots from the heart
    const dots = burst.value.children
    gsap.fromTo(dots, { x: 0, y: 0, scale: 1, opacity: 1 }, {
      x: i => Math.cos(i / dots.length * Math.PI * 2) * 34,
      y: i => Math.sin(i / dots.length * Math.PI * 2) * 34,
      scale: 0.2, opacity: 0, duration: 0.6, ease: 'power3.out',
    })
    gsap.fromTo(burst.value.parentElement, { scale: 0.7 }, { scale: 1, duration: 0.5, ease: 'back.out(4)' })
  }
  emit('toggle-save', props.place.id)
}

onMounted(() => {
  if (!interactive) return
  ctx = gsap.context(() => {
    rx = gsap.quickTo(card.value, 'rotationX', { duration: 0.5, ease: 'power3' })
    ry = gsap.quickTo(card.value, 'rotationY', { duration: 0.5, ease: 'power3' })
    const img = card.value.querySelector('.xc-photo img')
    if (img) {
      ix = gsap.quickTo(img, 'x', { duration: 0.8, ease: 'power3' })
      iy = gsap.quickTo(img, 'y', { duration: 0.8, ease: 'power3' })
    } else { ix = iy = () => {} }
  })
})
onUnmounted(() => ctx?.revert())
</script>

<template>
  <div class="xc-wrap" @pointermove="onMove" @pointerleave="onLeave">
    <article ref="card" class="xc position-relative" :class="{ 'xc--closed': !place.openNow }"
             :style="{ '--accent': accent }" data-test="place-card" data-cursor="open">
      <div class="xc-photo">
        <img v-if="place.photos?.length" :src="place.photos[0]" :alt="place.name" loading="lazy">
        <span class="xc-status" :class="place.openNow ? 'xc-status--open' : 'xc-status--closed'">
          {{ place.openNow ? 'open now' : 'closed' }}
        </span>
        <button class="xc-fav" type="button" :aria-pressed="saved"
                :aria-label="saved ? 'Remove from saved' : 'Save this place'"
                data-test="fav" data-cursor="save" @click="toggleSave">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
                  :fill="saved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
          </svg>
          <span ref="burst" class="xc-burst" aria-hidden="true"><i v-for="n in 8" :key="n"></i></span>
        </button>
      </div>

      <div class="xc-body">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <h3 class="xc-title">
            <RouterLink :to="'/places/' + place.id" class="text-decoration-none stretched-link"
                        style="color:inherit" data-test="place-link">{{ place.name }}</RouterLink>
          </h3>
          <SuitabilityScore :score="score" />
        </div>
        <div class="xc-meta">{{ place.area }} · {{ place.hours }}</div>
        <div v-if="place.intent" class="xc-intent" data-test="card-intent">
          <b>{{ place.intent.count }}</b> heading here
          {{ place.intent.day === 'Today' ? 'this' : 'tomorrow' }} {{ place.intent.label.toLowerCase() }}
          · {{ LEVEL_LABELS[place.intent.level] }}
        </div>
        <div class="xc-foot">
          <StarRating :value="place.rating" :count="place.reviewCount" />
        </div>
      </div>
      <span class="xc-shine" aria-hidden="true"></span>
    </article>
  </div>
</template>

<style scoped>
.xc-wrap { perspective: 900px; height: 100%; }
.xc {
  height: 100%; display: flex; flex-direction: column;
  background: var(--x-card); border: var(--x-line); border-radius: 24px; overflow: hidden;
  box-shadow: 6px 6px 0 var(--x-ink);
  transform-style: preserve-3d; will-change: transform;
  transition: box-shadow .3s var(--x-ease);
}
.xc-wrap:hover .xc { box-shadow: 10px 10px 0 var(--x-ink); }

.xc-photo { position: relative; aspect-ratio: 4 / 3; overflow: hidden; border-bottom: var(--x-line); background: var(--accent); }
.xc-photo img { position: absolute; inset: -16px; width: calc(100% + 32px); height: calc(100% + 32px);
                object-fit: cover; transition: scale .7s var(--x-ease-out), filter .4s; }
.xc-wrap:hover .xc-photo img { scale: 1.06; }
.xc--closed .xc-photo img { filter: grayscale(1) contrast(.9); }

.xc-status { position: absolute; left: 12px; top: 12px; z-index: 2;
             padding: 4px 10px; border: var(--x-line); border-radius: 999px;
             font-family: var(--x-mono); font-size: .66rem; font-weight: 500; text-transform: uppercase; letter-spacing: .05em;
             transform: rotate(-4deg); box-shadow: 2px 2px 0 var(--x-ink); }
.xc-status--open { background: var(--x-lime); color: var(--x-ink); }
.xc-status--closed { background: var(--x-ink); color: var(--x-paper); }

.xc-fav { position: absolute; right: 12px; top: 12px; z-index: 3; width: 40px; height: 40px;
          display: grid; place-items: center; border-radius: 50%;
          background: var(--x-card); color: var(--x-ink); border: var(--x-line); box-shadow: 2px 2px 0 var(--x-ink);
          transition: background-color .2s, color .2s; }
.xc-fav[aria-pressed="true"] { background: var(--x-orange); }
.xc-fav:hover { background: var(--x-pink); }
.xc-burst { position: absolute; inset: 50% auto auto 50%; pointer-events: none; }
.xc-burst i { position: absolute; width: 7px; height: 7px; margin: -3.5px; border-radius: 50%; opacity: 0;
              border: 1.5px solid var(--x-ink); }
.xc-burst i:nth-child(odd) { background: var(--x-orange); }
.xc-burst i:nth-child(even) { background: var(--x-lime); }

.xc-body { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px 18px; flex: 1; }
.xc-title { font-size: 1.35rem; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; margin: 0; }
.xc-meta { font-family: var(--x-mono); font-size: .74rem; text-transform: uppercase; letter-spacing: .03em; color: var(--x-muted); }
.xc-intent { align-self: flex-start; padding: 3px 10px; border-radius: 999px; background: var(--accent);
             border: 1.5px solid var(--x-ink); font-size: .8rem; color: var(--x-ink); }
.xc-foot { margin-top: auto; padding-top: 10px; border-top: 2px dashed rgba(21, 19, 15, .18); }

.xc-shine { position: absolute; inset: 0; pointer-events: none; opacity: 0; mix-blend-mode: soft-light;
            background: radial-gradient(circle at var(--shine-x, 50%) var(--shine-y, 50%), rgba(255,255,255,.75), transparent 45%);
            transition: opacity .3s; }
.xc-wrap:hover .xc-shine { opacity: 1; }
</style>
