<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { BASE_URL } from '../utils/api.js'
import { reducedMotion } from '../utils/motion.js'

const open = ref(false)
const input = ref('')
const loading = ref(false)
const messages = ref([
  {
    role: 'model',
    text: 'Hello! I’m your LockedIN study assistant. Ask me about finding a study spot or planning your next study session.',
  },
])
const root = ref(null)
const conversation = ref(null)
const messageInput = ref(null)
let requestController = null

const suggestions = [
  'Find a quiet spot near SMU',
  'Where can I study after 9pm?',
  'Help me plan a study session',
]

async function scrollToLatest() {
  await nextTick()
  if (conversation.value) {
    conversation.value.scrollTop = conversation.value.scrollHeight
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    window.dispatchEvent(new CustomEvent('floating-chat-open', { detail: 'assistant' }))
  } else {
    window.dispatchEvent(new CustomEvent('floating-chat-close', { detail: 'assistant' }))
  }
  if (open.value) {
    nextTick(() => messageInput.value?.focus())
    scrollToLatest()
  }
}

function onOtherChatOpened(event) {
  if (event.detail !== 'assistant') open.value = false
}

async function sendMessage(event) {
  event.preventDefault()
  const userPrompt = input.value.trim()
  if (!userPrompt || loading.value) return

  const history = messages.value
    .slice(1)
    .filter(message => message.role === 'user' || message.role === 'model')
    .slice(-10)
    .map(({ role, text }) => ({ role, text }))

  messages.value.push({ role: 'user', text: userPrompt })
  input.value = ''
  loading.value = true
  requestController = new AbortController()
  scrollToLatest()

  try {
    const response = await fetch(`${BASE_URL}/ai/study-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPrompt, history }),
      signal: requestController.signal,
    })
    const data = await response.json()

    if (!response.ok) {
      messages.value.push({
        role: 'error',
        // 503 = no GEMINI_API_KEY on the server, not something the user can fix by retrying
        text: response.status === 503
          ? 'The assistant isn’t switched on yet. Try again later.'
          : data.error || 'Sorry, I couldn’t get a response. Please try again.',
      })
      return
    }

    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('The study assistant returned an empty response.')
    }

    messages.value.push({ role: 'model', text: data.reply })
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Study assistant request failed:', error)
      messages.value.push({
        role: 'error',
        text: 'I couldn’t reach the study assistant. Check that the API server is running and try again.',
      })
    }
  } finally {
    loading.value = false
    requestController = null
    scrollToLatest()
  }
}

function useSuggestion(suggestion) {
  input.value = suggestion
  messageInput.value?.focus()
}

// close when the user presses anywhere outside the assistant, or hits Esc
function onOutsidePress(event) {
  if (open.value && root.value && !root.value.contains(event.target)) toggle()
}
function onKeydown(event) {
  if (open.value && event.key === 'Escape') toggle()
}

onMounted(() => {
  window.addEventListener('floating-chat-open', onOtherChatOpened)
  document.addEventListener('pointerdown', onOutsidePress)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  requestController?.abort()
  window.removeEventListener('floating-chat-open', onOtherChatOpened)
  document.removeEventListener('pointerdown', onOutsidePress)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="x-assist">
    <Transition :name="reducedMotion ? '' : 'x-pop'">
      <section v-if="open" id="assist-card" class="x-assist__card" role="dialog" aria-label="LockedIN study assistant">
        <header class="x-assist__header">
          <div>
            <strong class="x-assist__title">Study spot assistant</strong>
            <span class="x-mono x-assist__subtitle">here to help you lock in</span>
          </div>
          <span class="x-assist__spark" aria-hidden="true">✳</span>
        </header>

        <div ref="conversation" class="x-assist__messages" role="log" aria-live="polite" aria-label="Conversation">
          <div v-for="(message, index) in messages" :key="index" class="x-assist__message"
            :class="`x-assist__message--${message.role}`">
            {{ message.text }}
          </div>
          <div v-if="loading" class="x-assist__message x-assist__message--model" aria-label="Assistant is thinking">
            Thinking…
          </div>
        </div>

        <div v-if="messages.length === 1" class="x-assist__suggestions" aria-label="Try asking">
          <button v-for="suggestion in suggestions" :key="suggestion" type="button" class="x-assist__suggestion"
            @click="useSuggestion(suggestion)">
            {{ suggestion }}
          </button>
        </div>

        <form class="x-assist__form" @submit="sendMessage">
          <input ref="messageInput" v-model="input" class="x-assist__input" type="text" maxlength="2000"
            placeholder="Ask about study places..." aria-label="Message the study assistant" autocomplete="off">
          <button class="x-assist__send" type="submit" :disabled="loading || !input.trim()">
            Send
          </button>
        </form>
      </section>
    </Transition>

    <button type="button" class="x-assist__btn" :aria-expanded="open" aria-controls="assist-card"
      :aria-label="open ? 'Close assistant' : 'Open study assistant'" data-cursor="Ask Locker" data-test="assistant-btn"
      @click="toggle">
      <svg v-if="!open" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <!-- bot: antenna, rounded head, eyes, mouth -->
        <path d="M12 3.5v3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="12" cy="3" r="1.3" fill="currentColor" />
        <rect x="4.5" y="7" width="15" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="2.2" />
        <path d="M2.5 12v3M21.5 12v3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        <path d="M9.2 12h.01M14.8 12h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        <path d="M9.5 15.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.x-assist {
  position: fixed;
  left: 18px;
  bottom: 18px;
  z-index: 1040;
  padding-bottom: env(safe-area-inset-bottom);
}

.x-assist__btn {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--x-lilac);
  color: var(--x-ink);
  border: var(--x-line);
  box-shadow: var(--x-pop);
  transition: transform .2s var(--x-ease), background-color .2s;
}

.x-assist__btn:hover {
  transform: translate(-2px, -2px) rotate(-6deg);
}

.x-assist__btn[aria-expanded="true"] {
  background: var(--x-ink);
  color: var(--x-lime);
}

.x-assist__card {
  position: absolute;
  left: 0;
  bottom: 66px;
  display: flex;
  flex-direction: column;
  width: min(360px, calc(100vw - 36px));
  max-height: min(520px, calc(100dvh - 112px));
  padding: 14px;
  background: var(--x-ink);
  color: var(--x-paper);
  border: var(--x-line);
  border-radius: 18px;
  box-shadow: 5px 5px 0 var(--x-orange);
}

.x-assist__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 12px;
}

.x-assist__title {
  display: block;
  font-size: 1.05rem;
}

.x-assist__subtitle {
  display: block;
  margin-top: 2px;
  color: var(--x-lime);
  font-size: .63rem;
}

.x-assist__spark {
  color: var(--x-lime);
  font-size: 1.4rem;
}

.x-assist__messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 9px;
  min-height: 100px;
  overflow-y: auto;
  padding: 4px 3px 10px;
  overscroll-behavior: contain;
}

.x-assist__message {
  max-width: 88%;
  padding: 9px 11px;
  border: 1px solid rgba(243, 238, 227, .22);
  border-radius: 13px;
  font-size: .88rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.x-assist__message--model {
  align-self: flex-start;
  background: rgba(243, 238, 227, .08);
}

.x-assist__message--user {
  align-self: flex-end;
  background: var(--x-lime);
  color: var(--x-ink);
  border-color: var(--x-lime);
}

.x-assist__message--error {
  align-self: flex-start;
  color: var(--x-paper);
  border-color: var(--x-orange);
}

.x-assist__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 0 10px;
}

.x-assist__suggestion {
  padding: 5px 9px;
  border: 1px solid rgba(243, 238, 227, .35);
  border-radius: 999px;
  background: transparent;
  color: var(--x-paper);
  font-size: .72rem;
  text-align: left;
}

.x-assist__suggestion:hover {
  border-color: var(--x-lime);
  color: var(--x-lime);
}

.x-assist__form {
  display: flex;
  gap: 7px;
  padding-top: 10px;
  border-top: 1px solid rgba(243, 238, 227, .2);
}

.x-assist__input {
  min-width: 0;
  flex: 1;
  padding: 9px 11px;
  border: 1.5px solid rgba(243, 238, 227, .3);
  border-radius: 12px;
  outline: none;
  background: rgba(243, 238, 227, .08);
  color: var(--x-paper);
  font: inherit;
  font-size: .85rem;
}

.x-assist__input::placeholder {
  color: rgba(243, 238, 227, .58);
}

.x-assist__input:focus {
  border-color: var(--x-lime);
}

.x-assist__send {
  padding: 0 13px;
  border: var(--x-line);
  border-radius: 12px;
  background: var(--x-orange);
  color: var(--x-ink);
  font-weight: 700;
}

.x-assist__send:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.x-pop-enter-active,
.x-pop-leave-active {
  transition: opacity .2s, transform .25s var(--x-ease);
  transform-origin: bottom left;
}

.x-pop-enter-from,
.x-pop-leave-to {
  opacity: 0;
  transform: scale(.85) translateY(8px);
}

@media (prefers-reduced-motion: reduce) {

  .x-pop-enter-active,
  .x-pop-leave-active {
    transition: none;
  }
}
</style>
