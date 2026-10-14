<script setup>
/* Floating assistant button (bottom left). Not implemented yet:
 * opening it just shows a small "coming soon" card. */
import { ref, onUnmounted } from 'vue'
import { reducedMotion } from '../utils/motion.js'

const open = ref(false)
const typed = ref('')
let timer = null

const PROMPTS = [
  'quiet spot near SMU for four people this afternoon',
  'somewhere open past 9pm with sockets',
  'indoor, cold aircon, no crowds please',
]

// typewriter of example questions while the card is open
function typeLoop(i = 0, c = 0, deleting = false) {
  const text = PROMPTS[i]
  typed.value = text.slice(0, c)
  let next = 45, ni = i, nc = c + 1, nd = deleting
  if (!deleting && c === text.length) { nd = true; next = 1800; nc = c }
  else if (deleting) { nc = c - 1; next = 22; if (c === 0) { nd = false; ni = (i + 1) % PROMPTS.length; nc = 0; next = 300 } }
  timer = setTimeout(() => typeLoop(ni, nc, nd), next)
}

function toggle() {
  open.value = !open.value
  clearTimeout(timer)
  if (open.value) {
    if (reducedMotion) typed.value = PROMPTS[0]
    else typeLoop()
  }
}

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="x-assist">
    <Transition name="x-pop">
      <div v-if="open" id="assist-card" class="x-assist__card" role="dialog" aria-label="LockedIN assistant">
        <span class="x-mono x-assist__soon">coming soon</span>
        <strong class="x-assist__title">Just tell it what you need.</strong>
        <div class="x-assist__prompt"><span class="x-mono">ask ›</span> {{ typed }}<i class="x-assist__caret"></i></div>
      </div>
    </Transition>
    <button type="button" class="x-assist__btn" :aria-expanded="open" aria-controls="assist-card"
            :aria-label="open ? 'Close assistant' : 'Open assistant (coming soon)'"
            data-cursor="ask" data-test="assistant-btn" @click="toggle">
      <svg v-if="!open" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 5.5h16v10H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
        <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.x-assist { position: fixed; left: 18px; bottom: 18px; z-index: 1040;
            padding-bottom: env(safe-area-inset-bottom); }
.x-assist__btn {
  width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center;
  background: var(--x-lilac); color: var(--x-ink); border: var(--x-line); box-shadow: var(--x-pop);
  transition: transform .2s var(--x-ease), background-color .2s;
}
.x-assist__btn:hover { transform: translate(-2px, -2px) rotate(-6deg); }
.x-assist__btn[aria-expanded="true"] { background: var(--x-ink); color: var(--x-lime); }
.x-assist__card {
  position: absolute; left: 0; bottom: 66px; width: min(300px, calc(100vw - 36px));
  padding: 14px 16px; background: var(--x-ink); color: var(--x-paper);
  border: var(--x-line); border-radius: 18px; box-shadow: 5px 5px 0 var(--x-orange);
}
.x-assist__soon { color: var(--x-lime); font-size: .66rem; display: block; }
.x-assist__title { display: block; font-size: 1.05rem; margin: 2px 0 8px; }
.x-assist__prompt { min-height: 2.6em; padding: 8px 10px; border-radius: 12px; font-size: .86rem;
                    background: rgba(243, 238, 227, .08); border: 1.5px solid rgba(243, 238, 227, .25); }
.x-assist__prompt .x-mono { color: var(--x-lime); font-size: .66rem; }
.x-assist__caret { display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: text-bottom;
                   background: var(--x-lime); animation: x-assist-blink 1s steps(1) infinite; }
@keyframes x-assist-blink { 50% { opacity: 0; } }

.x-pop-enter-active, .x-pop-leave-active { transition: opacity .2s, transform .25s var(--x-ease); transform-origin: bottom left; }
.x-pop-enter-from, .x-pop-leave-to { opacity: 0; transform: scale(.85) translateY(8px); }

@media (prefers-reduced-motion: reduce) {
  .x-assist__caret { animation: none; }
  .x-pop-enter-active, .x-pop-leave-active { transition: none; }
}
</style>
