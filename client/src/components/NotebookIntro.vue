<script setup>
/* LockedIN notebook intro (Design 2).
 * A 3D notebook with stickers tilts with the mouse. Opening plays one GSAP
 * timeline: stickers pop, cover swings, pages riffle, camera dives into the
 * first page, then the homepage is revealed through a growing circle.
 * Click / Enter / Space opens it, Esc or Skip jumps straight in. */
import { ref, onMounted, onUnmounted } from 'vue'
import { gsap, lockScroll } from '../utils/motion.js'
import logoUrl from '../assets/logo.svg'

const emit = defineEmits(['reveal', 'opened'])

const root = ref(null)
const book = ref(null)
const opening = ref(false)
let ctx = null
let tiltX = null, tiltY = null
let autoTimer = null

function onPointerMove(e) {
  if (opening.value || !tiltX) return
  const nx = e.clientX / window.innerWidth - 0.5
  const ny = e.clientY / window.innerHeight - 0.5
  tiltY(-24 + nx * 26)
  tiltX(16 - ny * 18)
}

// Run outside any GSAP callback: anything created inside a callback would be
// adopted by this component's context and destroyed with it on unmount.
function outside(fn) {
  setTimeout(fn, 0)
}

function finish() {
  outside(() => {
    lockScroll(false)
    emit('reveal')
    emit('opened')
  })
}

function open() {
  if (opening.value) return
  opening.value = true
  clearTimeout(autoTimer)
  const q = gsap.utils.selector(root.value)
  const box = book.value.getBoundingClientRect()
  const zoom = Math.max(window.innerWidth / box.width, window.innerHeight / box.height) * 1.25

  ctx.add(() => {
    gsap.timeline({ defaults: { ease: 'power3.inOut' } })
      .to(q('.x-sticker'), { scale: 1.25, rotation: '+=12', duration: 0.18, stagger: 0.04, ease: 'power2.out' })
      .to(q('.x-sticker'), { scale: 1, rotation: '-=12', duration: 0.3, stagger: 0.04, ease: 'back.out(3)' })
      .to(book.value, { rotationX: 0, rotationY: 0, rotationZ: 0, duration: 0.9 }, 0.1)
      .to(q('.x-hint'), { autoAlpha: 0, y: 20, duration: 0.3 }, 0)
      .to(q('.x-book__cover'), { rotationY: -168, duration: 1.15 }, 0.55)
      .to(q('.x-book__leaf'), { rotationY: -164, duration: 0.75, stagger: 0.09, ease: 'power2.inOut' }, 0.8)
      .add('dive', 1.75)
      .to(book.value, { scale: zoom, duration: 1.05, ease: 'power4.in' }, 'dive')
      .to(q('.x-book__page-inner > *'), { y: -6, duration: 1, stagger: 0.04, ease: 'none' }, 'dive')
      .call(() => outside(() => emit('reveal')), null, 'dive+=0.75')
      .fromTo(root.value, { '--hole': '0vmax' },
        { '--hole': '150vmax', duration: 0.9, ease: 'power2.in' }, 'dive+=0.7')
      .call(finish)
  })
}

function skip() {
  clearTimeout(autoTimer)
  ctx?.revert()
  finish()
}

function onKey(e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
  if (e.key === 'Escape') skip()
}

onMounted(() => {
  lockScroll(true)
  ctx = gsap.context(() => {
    const q = gsap.utils.selector(root.value)
    gsap.set(book.value, { rotationX: 16, rotationY: -24, rotationZ: 5 })
    tiltX = gsap.quickTo(book.value, 'rotationX', { duration: 0.9, ease: 'power3' })
    tiltY = gsap.quickTo(book.value, 'rotationY', { duration: 0.9, ease: 'power3' })

    // entrance: book drops in, stickers slap on one by one
    gsap.timeline()
      .from(book.value, { y: 120, autoAlpha: 0, rotationZ: -18, duration: 1.1, ease: 'expo.out' })
      .from(q('.x-sticker'), { scale: 0, rotation: -40, duration: 0.55, stagger: 0.12, ease: 'back.out(2.6)' }, '-=0.5')
      .from(q('.x-hint > *'), { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out' }, '-=0.3')
    // gentle idle bob
    gsap.to(q('.x-book-float'), { y: -10, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
  }, root.value)

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('keydown', onKey)
  autoTimer = setTimeout(open, 5200)   // opens by itself if nobody clicks
})

onUnmounted(() => {
  clearTimeout(autoTimer)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('keydown', onKey)
  ctx?.revert()
  lockScroll(false)
})
</script>

<template>
  <div ref="root" class="x-intro" data-test="notebook-intro" role="dialog" aria-label="LockedIN notebook opening">
    <div class="x-intro__blob x-intro__blob--a" aria-hidden="true"></div>
    <div class="x-intro__blob x-intro__blob--b" aria-hidden="true"></div>

    <div class="x-stage">
      <div class="x-book-float">
        <div ref="book" class="x-book" data-cursor="open" @click="open">
          <div class="x-book__back"></div>
          <div class="x-book__edge x-book__edge--right"></div>
          <div class="x-book__edge x-book__edge--bottom"></div>

          <!-- first page: the homepage in miniature -->
          <div class="x-book__page">
            <div class="x-book__page-inner">
              <span class="x-mini-kicker">today's plan</span>
              <span class="x-mini-title">LOCK<br>IN.</span>
              <span class="x-mini-pills"><i></i><i></i><i></i></span>
              <span class="x-mini-sun"></span>
              <span class="x-mini-line"></span><span class="x-mini-line x-mini-line--short"></span>
            </div>
          </div>

          <div v-for="n in 4" :key="n" class="x-book__leaf" :style="{ '--z': (5 - n) * 1.2 + 'px' }"></div>

          <div class="x-book__cover">
            <div class="x-book__front">
              <img :src="logoUrl" alt="" class="x-book__logo">
              <span class="x-book__title">LockedIN</span>
              <span class="x-book__sub">field notes for studying in SG</span>
              <span class="x-book__elastic"></span>

              <span class="x-sticker x-sticker--mode">STUDY MODE: ON</span>
              <span class="x-sticker x-sticker--sg">SG</span>
              <svg class="x-sticker x-sticker--star" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M50 4l12 30 32 2-25 20 9 32-28-18-28 18 9-32L6 36l32-2z" fill="#FFD84A" stroke="#15130F"
                  stroke-width="4" stroke-linejoin="round" />
              </svg>
              <svg class="x-sticker x-sticker--cup" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M22 38h46v26a18 18 0 0 1-18 18H40a18 18 0 0 1-18-18z" fill="#FFFDF8" stroke="#15130F"
                  stroke-width="5" stroke-linejoin="round" />
                <path d="M68 46h6a10 10 0 0 1 0 20h-6" fill="none" stroke="#15130F" stroke-width="5" />
                <path d="M36 14c-4 6 4 10 0 16M50 12c-4 6 4 10 0 18" fill="none" stroke="#FF5B22" stroke-width="5"
                  stroke-linecap="round" />
              </svg>
            </div>
            <div class="x-book__inside"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="x-hint">
      <span class="x-hint__key">click the notebook</span>
      <span class="x-hint__or">or press</span>
      <kbd>Enter</kbd>
    </div>

    <button type="button" class="x-intro__skip" data-test="notebook-skip" @click.stop="skip">Skip intro</button>
  </div>
</template>

<style scoped>
.x-intro {
  --hole: 0vmax;
  position: fixed;
  inset: 0;
  z-index: 2000;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--x-paper);
  /* the hole grows at the end of the intro to reveal the homepage */
  -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent var(--hole), #000 calc(var(--hole) + 1px));
  mask-image: radial-gradient(circle at 50% 50%, transparent var(--hole), #000 calc(var(--hole) + 1px));
}

.x-intro__blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: .55;
  pointer-events: none;
}

.x-intro__blob--a {
  width: 46vmax;
  height: 46vmax;
  left: -12vmax;
  top: -14vmax;
  background: var(--x-lilac);
  animation: x-drift 14s ease-in-out infinite alternate;
}

.x-intro__blob--b {
  width: 40vmax;
  height: 40vmax;
  right: -10vmax;
  bottom: -16vmax;
  background: var(--x-lime);
  animation: x-drift 17s ease-in-out infinite alternate-reverse;
}

@keyframes x-drift {
  to {
    transform: translate(8vmax, 6vmax) scale(1.15);
  }
}

.x-stage {
  perspective: 1600px;
}

.x-book {
  position: relative;
  width: min(66vw, 300px);
  aspect-ratio: 3 / 4;
  transform-style: preserve-3d;
  will-change: transform;
}

.x-book__back,
.x-book__page,
.x-book__leaf,
.x-book__cover,
.x-book__front,
.x-book__inside {
  position: absolute;
  inset: 0;
  border-radius: 4px 16px 16px 4px;
}

.x-book__back {
  background: var(--x-ink);
  transform: translateZ(-10px);
  box-shadow: 30px 40px 60px -20px rgba(21, 19, 15, .45);
}

.x-book__edge {
  position: absolute;
  background:
    repeating-linear-gradient(90deg, #FFFDF8 0 2px, #E4DCCB 2px 3px);
}

.x-book__edge--right {
  top: 3px;
  bottom: 3px;
  right: 0;
  width: 18px;
  transform-origin: right center;
  transform: translateZ(-9px) rotateY(90deg);
  background: repeating-linear-gradient(90deg, #FFFDF8 0 2px, #E4DCCB 2px 3px);
}

.x-book__edge--bottom {
  left: 3px;
  right: 3px;
  bottom: 0;
  height: 18px;
  transform-origin: center bottom;
  transform: translateZ(-9px) rotateX(-90deg);
  background: repeating-linear-gradient(0deg, #FFFDF8 0 2px, #E4DCCB 2px 3px);
}

.x-book__page {
  background: var(--x-card);
  transform: translateZ(2px);
  border: 2px solid var(--x-ink);
  overflow: hidden;
}

.x-book__page-inner {
  position: absolute;
  inset: 0;
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-image: repeating-linear-gradient(0deg, transparent 0 21px, rgba(143, 211, 255, .35) 21px 22px);
}

.x-mini-kicker {
  font-family: var(--x-mono);
  font-size: .62rem;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--x-muted);
}

.x-mini-title {
  font-weight: 800;
  font-size: 3.1rem;
  line-height: .85;
  letter-spacing: -.05em;
  color: var(--x-ink);
}

.x-mini-pills {
  display: flex;
  gap: 6px;
}

.x-mini-pills i {
  width: 40px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid var(--x-ink);
}

.x-mini-pills i:nth-child(1) {
  background: var(--x-orange);
}

.x-mini-pills i:nth-child(2) {
  background: var(--x-lime);
}

.x-mini-pills i:nth-child(3) {
  background: var(--x-lilac);
}

.x-mini-sun {
  position: absolute;
  right: 18px;
  top: 46px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--x-butter);
  border: 2px solid var(--x-ink);
}

.x-mini-line {
  height: 6px;
  border-radius: 3px;
  background: var(--x-paper-2);
  margin-top: auto;
}

.x-mini-line--short {
  width: 60%;
  margin-top: 0;
}

.x-book__leaf {
  background: #FFFDF8;
  border: 1.5px solid #D8CFBC;
  transform-origin: left center;
  transform: translateZ(var(--z));
  backface-visibility: visible;
}

.x-book__cover {
  transform-origin: left center;
  transform-style: preserve-3d;
  transform: translateZ(10px);
}

.x-book__front,
.x-book__inside {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.x-book__front {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--x-orange);
  border: 2px solid var(--x-ink);
  border-left: 14px solid var(--x-ink);
  overflow: visible;
}

.x-book__inside {
  transform: rotateY(180deg);
  background: var(--x-paper-2);
  border: 2px solid var(--x-ink);
}

.x-book__logo {
  width: 76px;
  height: 76px;
  padding: 10px;
  background: var(--x-card);
  border: 2px solid var(--x-ink);
  border-radius: 18px;
  box-shadow: var(--x-pop);
}

.x-book__title {
  font-weight: 800;
  font-size: 2.6rem;
  letter-spacing: -.05em;
  color: var(--x-ink);
  line-height: 1;
}

.x-book__sub {
  font-family: var(--x-mono);
  font-size: .6rem;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--x-ink);
  max-width: 70%;
  text-align: center;
}

.x-book__elastic {
  position: absolute;
  top: -2px;
  bottom: -2px;
  right: 30px;
  width: 9px;
  background: var(--x-ink);
}

.x-sticker {
  position: absolute;
  display: inline-grid;
  place-items: center;
}

.x-sticker--mode {
  left: -18px;
  top: 28px;
  padding: 6px 12px;
  background: var(--x-lime);
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  font-family: var(--x-mono);
  font-size: .62rem;
  font-weight: 500;
  letter-spacing: .06em;
  transform: rotate(-12deg);
  box-shadow: 3px 3px 0 var(--x-ink);
}

.x-sticker--sg {
  right: -20px;
  bottom: 58px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: var(--x-lilac);
  border: 2px solid var(--x-ink);
  font-weight: 800;
  font-size: 1.1rem;
  transform: rotate(14deg);
  box-shadow: 3px 3px 0 var(--x-ink);
}

.x-sticker--star {
  width: 58px;
  right: 8px;
  top: -22px;
  transform: rotate(10deg);
}

.x-sticker--cup {
  width: 62px;
  left: 14px;
  bottom: 10px;
  transform: rotate(-8deg);
}

.x-hint {
  position: absolute;
  bottom: 9vh;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--x-mono);
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--x-ink);
}

.x-hint__key {
  background: var(--x-ink);
  color: var(--x-paper);
  padding: 4px 10px;
  border-radius: 999px;
}

.x-hint kbd {
  background: var(--x-card);
  color: var(--x-ink);
  border: 2px solid var(--x-ink);
  border-radius: 8px;
  box-shadow: 2px 2px 0 var(--x-ink);
  font-family: var(--x-mono);
  padding: 2px 8px;
}

.x-intro__skip {
  position: absolute;
  right: 18px;
  bottom: 18px;
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-card);
  color: var(--x-ink);
  padding: 6px 14px;
  font-weight: 700;
  font-size: .85rem;
  box-shadow: 3px 3px 0 var(--x-ink);
}

.x-intro__skip:hover {
  background: var(--x-lime);
}

@media (max-width: 575.98px) {
  .x-hint {
    bottom: 11vh;
    font-size: .68rem;
  }

  .x-hint__or,
  .x-hint kbd {
    display: none;
  }
}
</style>
