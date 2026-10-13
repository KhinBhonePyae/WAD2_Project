<script setup>
/* Dot + trailing ring. Over links/buttons the ring grows; elements with
 * data-cursor="label" show that label inside the ring. Mouse only. */
import { ref, onMounted, onUnmounted } from 'vue'
import { gsap, finePointer, reducedMotion } from '../utils/motion.js'

const dot = ref(null)
const ring = ref(null)
const label = ref('')
const state = ref('')   // '', 'link', 'label', 'down'
const visible = ref(false)
const enabled = finePointer && !reducedMotion

let moveDot, moveDotY, moveRing, moveRingY

function onMove(e) {
  visible.value = true
  moveDot(e.clientX); moveDotY(e.clientY)
  moveRing(e.clientX); moveRingY(e.clientY)

  const target = e.target.closest?.('[data-cursor], a, button, input, select, textarea, label, [role="button"]')
  if (!target) { state.value = ''; label.value = ''; return }
  const text = target.getAttribute('data-cursor')
  if (text) { state.value = 'label'; label.value = text }
  else if (/INPUT|TEXTAREA|SELECT/.test(target.tagName)) { state.value = 'text'; label.value = '' }
  else { state.value = 'link'; label.value = '' }
}

function onDown() { ring.value?.classList.add('x-cursor__ring--down') }
function onUp() { ring.value?.classList.remove('x-cursor__ring--down') }
function onLeave() { visible.value = false }

onMounted(() => {
  if (!enabled) return
  document.documentElement.classList.add('x-has-cursor')
  moveDot = gsap.quickTo(dot.value, 'x', { duration: 0.08, ease: 'power3' })
  moveDotY = gsap.quickTo(dot.value, 'y', { duration: 0.08, ease: 'power3' })
  moveRing = gsap.quickTo(ring.value, 'x', { duration: 0.45, ease: 'power3' })
  moveRingY = gsap.quickTo(ring.value, 'y', { duration: 0.45, ease: 'power3' })
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  document.addEventListener('mouseleave', onLeave)
})

onUnmounted(() => {
  if (!enabled) return
  document.documentElement.classList.remove('x-has-cursor')
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerdown', onDown)
  window.removeEventListener('pointerup', onUp)
  document.removeEventListener('mouseleave', onLeave)
})
</script>

<template>
  <div v-if="enabled" class="x-cursor" :class="{ 'x-cursor--hidden': !visible }" aria-hidden="true">
    <div ref="ring" class="x-cursor__ring" :class="'x-cursor__ring--' + (state || 'idle')">
      <span class="x-cursor__label">{{ label }}</span>
    </div>
    <div ref="dot" class="x-cursor__dot" :class="{ 'x-cursor__dot--hide': state === 'label' }"></div>
  </div>
</template>

<style scoped>
.x-cursor { position: fixed; inset: 0; z-index: 9500; pointer-events: none; transition: opacity .2s; }
.x-cursor--hidden { opacity: 0; }
.x-cursor__dot, .x-cursor__ring { position: fixed; left: 0; top: 0; will-change: transform; }
.x-cursor__dot {
  width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%;
  background: var(--x-orange); transition: opacity .15s, scale .2s;
}
.x-cursor__dot--hide { opacity: 0; }
.x-cursor__ring {
  width: 38px; height: 38px; margin: -19px 0 0 -19px; border-radius: 50%;
  border: 1.5px solid var(--x-ink);
  display: grid; place-items: center;
  transition: width .35s var(--x-ease), height .35s var(--x-ease), margin .35s var(--x-ease),
              background-color .25s, border-color .25s, scale .15s;
}
.x-cursor__ring--link { width: 58px; height: 58px; margin: -29px 0 0 -29px; background: rgba(198, 244, 50, .35); }
.x-cursor__ring--text { width: 6px; height: 34px; margin: -17px 0 0 -3px; border-radius: 3px; background: var(--x-ink); }
.x-cursor__ring--label { width: 86px; height: 86px; margin: -43px 0 0 -43px; background: var(--x-lime); }
.x-cursor__ring--down { scale: .8; }
.x-cursor__label {
  font-family: var(--x-mono); font-size: .68rem; font-weight: 500; text-transform: uppercase;
  letter-spacing: .06em; color: var(--x-ink); opacity: 0; transition: opacity .2s;
}
.x-cursor__ring--label .x-cursor__label { opacity: 1; }
</style>
