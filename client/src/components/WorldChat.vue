<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { BASE_URL } from '../utils/api.js'
import { reducedMotion } from '../utils/motion.js'

const props = defineProps({
  user: {
    type: Object,
    default: null,
  },
})

const open = ref(false)
const assistantOpen = ref(false)
const messages = ref([])
const draft = ref('')
const loadingMessages = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const conversation = ref(null)
const messageInput = ref(null)
const hasUser = computed(() => Boolean(props.user))

let pollTimer = null
let requestController = null
let requestInProgress = false

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  requestController?.abort()
  requestController = null
}

async function scrollToLatest() {
  await nextTick()
  if (conversation.value) {
    conversation.value.scrollTop = conversation.value.scrollHeight
  }
}

function mergeMessages(incoming) {
  const byId = new Map(messages.value.map(message => [message.id, message]))
  let hasNewMessages = false
  for (const message of incoming) {
    if (!byId.has(message.id)) hasNewMessages = true
    byId.set(message.id, message)
  }
  messages.value = [...byId.values()]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-100)
  return hasNewMessages
}

async function loadMessages({ initial = false } = {}) {
  if (!open.value || !hasUser.value || requestInProgress) return

  requestInProgress = true
  if (initial) loadingMessages.value = true
  requestController = new AbortController()

  try {
    const response = await fetch(`${BASE_URL}/world-chat/messages`, {
      headers: authHeaders(),
      signal: requestController.signal,
    })
    const data = await response.json()

    if (!response.ok) {
      errorMessage.value = response.status === 401
        ? 'Your login session has expired. Please log in again.'
        : data.error || 'Could not load world chat. Please try again.'
      if (response.status === 401) stopPolling()
      return
    }

    if (!Array.isArray(data.messages)) {
      throw new Error('The world chat returned an invalid message list.')
    }

    errorMessage.value = ''
    const wasAtBottom = !conversation.value ||
      conversation.value.scrollHeight - conversation.value.scrollTop - conversation.value.clientHeight < 40
    const hasNewMessages = mergeMessages(data.messages)
    if (initial || (hasNewMessages && wasAtBottom)) await scrollToLatest()
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Could not load world chat:', error)
      errorMessage.value = 'Could not connect to world chat. Check that the API server is running.'
    }
  } finally {
    requestInProgress = false
    requestController = null
    loadingMessages.value = false
  }
}

function onOtherChatOpened(event) {
  assistantOpen.value = event.detail === 'assistant'
  if (event.detail !== 'world-chat') closePanel()
}

function onOtherChatClosed(event) {
  if (event.detail === 'assistant') assistantOpen.value = false
}

function closePanel() {
  open.value = false
  stopPolling()
}

function toggle() {
  if (open.value) {
    closePanel()
    return
  }

  open.value = true
  errorMessage.value = ''
  window.dispatchEvent(new CustomEvent('floating-chat-open', { detail: 'world-chat' }))
  nextTick(() => messageInput.value?.focus())
  loadMessages({ initial: true })
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadMessages()
  }, 3000)
}

async function sendMessage(event) {
  event.preventDefault()
  const text = draft.value.trim()
  if (!text || sending.value || !hasUser.value) return

  sending.value = true
  errorMessage.value = ''
  try {
    const response = await fetch(`${BASE_URL}/world-chat/messages`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    const data = await response.json()

    if (!response.ok) {
      errorMessage.value = response.status === 401
        ? 'Your login session has expired. Please log in again.'
        : data.error || 'Could not send your message. Please try again.'
      return
    }

    if (!data.message?.id) {
      throw new Error('The world chat returned an invalid message.')
    }

    draft.value = ''
    mergeMessages([data.message])
    await scrollToLatest()
  } catch (error) {
    console.error('Could not send world chat message:', error)
    errorMessage.value = 'Could not send your message. Check that the API server is running and try again.'
  } finally {
    sending.value = false
  }
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

watch(hasUser, (loggedIn) => {
  if (!loggedIn) {
    closePanel()
    messages.value = []
    errorMessage.value = ''
    draft.value = ''
  }
})

onMounted(() => {
  window.addEventListener('floating-chat-open', onOtherChatOpened)
  window.addEventListener('floating-chat-close', onOtherChatClosed)
})
onUnmounted(() => {
  stopPolling()
  window.removeEventListener('floating-chat-open', onOtherChatOpened)
  window.removeEventListener('floating-chat-close', onOtherChatClosed)
})
</script>

<template>
  <div v-if="hasUser" class="x-world-chat">
    <Transition :name="reducedMotion ? '' : 'x-world-chat-pop'">
      <section v-if="open" id="world-chat-panel" class="x-world-chat__panel" role="dialog" aria-label="World chat">
        <header class="x-world-chat__header">
          <div>
            <strong class="x-world-chat__title">World chat</strong>
            <span class="x-mono x-world-chat__subtitle">say hi to the community</span>
          </div>
          <span class="x-world-chat__live"><i></i> LIVE</span>
        </header>

        <div ref="conversation" class="x-world-chat__messages" role="log" aria-live="polite"
          aria-label="World chat messages">
          <p v-if="loadingMessages && !messages.length" class="x-world-chat__empty">
            Loading the conversation...
          </p>
          <template v-else-if="!messages.length && !errorMessage">
            <p class="x-world-chat__empty">No messages yet. Start the conversation!</p>
          </template>
          <article v-for="message in messages" :key="message.id" class="x-world-chat__message">
            <div class="x-world-chat__message-meta">
              <strong>{{ message.author }}</strong>
              <time :datetime="message.createdAt">{{ formatTime(message.createdAt) }}</time>
            </div>
            <p>{{ message.text }}</p>
          </article>
        </div>

        <p v-if="errorMessage" class="x-world-chat__error" role="alert">
          {{ errorMessage }}
          <RouterLink v-if="errorMessage.includes('log in again')" to="/login" @click="closePanel">
            Log in
          </RouterLink>
        </p>

        <form class="x-world-chat__form" @submit="sendMessage">
          <input ref="messageInput" v-model="draft" class="x-world-chat__input" type="text" maxlength="500"
            placeholder="Write a message..." aria-label="Write a world chat message" autocomplete="off">
          <button class="x-world-chat__send" type="submit" :disabled="sending || !draft.trim()">
            {{ sending ? '...' : 'Send' }}
          </button>
        </form>
        <span class="x-world-chat__hint">Messages are visible to all logged-in users.</span>
      </section>
    </Transition>

    <button v-if="!assistantOpen" type="button" class="x-world-chat__button" :aria-expanded="open"
      aria-controls="world-chat-panel" :aria-label="open ? 'Close world chat' : 'Open world chat'" data-cursor="ask"
      data-test="world-chat-btn" @click="toggle">
      <svg v-if="!open" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 5.5h16v10H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
        <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke="currentColor" stroke-width="2.6"
          stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.x-world-chat {
  position: fixed;
  left: 18px;
  bottom: 84px;
  z-index: 1041;
  padding-bottom: env(safe-area-inset-bottom);
}

.x-world-chat__button {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--x-lime);
  color: var(--x-ink);
  border: var(--x-line);
  box-shadow: var(--x-pop);
  transition: transform .2s var(--x-ease), background-color .2s;
}

.x-world-chat__button:hover {
  transform: translate(-2px, -2px) rotate(6deg);
}

.x-world-chat__button[aria-expanded="true"] {
  background: var(--x-ink);
  color: var(--x-lime);
}

.x-world-chat__panel {
  position: absolute;
  left: 0;
  bottom: 66px;
  display: flex;
  flex-direction: column;
  width: min(360px, calc(100vw - 36px));
  max-height: min(520px, calc(100dvh - 178px));
  min-height: min(320px, calc(100dvh - 178px));
  padding: 14px;
  background: var(--x-ink);
  color: var(--x-paper);
  border: var(--x-line);
  border-radius: 18px;
  box-shadow: 5px 5px 0 var(--x-lime);
}

.x-world-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 12px;
  border-bottom: 1px solid rgba(243, 238, 227, .2);
}

.x-world-chat__title {
  display: block;
  font-size: 1.05rem;
}

.x-world-chat__subtitle {
  display: block;
  margin-top: 2px;
  color: var(--x-lime);
  font-size: .63rem;
}

.x-world-chat__live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--x-lime);
  font: .62rem 'DM Mono', monospace;
}

.x-world-chat__live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.x-world-chat__messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 100px;
  overflow-y: auto;
  padding: 12px 3px;
  overscroll-behavior: contain;
}

.x-world-chat__empty {
  margin: auto;
  padding: 18px;
  color: rgba(243, 238, 227, .7);
  font-size: .86rem;
  text-align: center;
}

.x-world-chat__message {
  align-self: flex-start;
  max-width: 95%;
  margin: 0;
}

.x-world-chat__message-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 3px 2px;
}

.x-world-chat__message-meta strong {
  color: var(--x-lime);
  font-size: .74rem;
}

.x-world-chat__message-meta time {
  color: rgba(243, 238, 227, .58);
  font-size: .63rem;
}

.x-world-chat__message>p {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(243, 238, 227, .22);
  border-radius: 12px;
  background: rgba(243, 238, 227, .08);
  font-size: .86rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.x-world-chat__error {
  margin: 0 0 8px;
  color: #ffb19e;
  font-size: .75rem;
}

.x-world-chat__error a {
  color: var(--x-lime);
}

.x-world-chat__form {
  display: flex;
  gap: 7px;
  padding-top: 10px;
  border-top: 1px solid rgba(243, 238, 227, .2);
}

.x-world-chat__input {
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

.x-world-chat__input::placeholder {
  color: rgba(243, 238, 227, .58);
}

.x-world-chat__input:focus {
  border-color: var(--x-lime);
}

.x-world-chat__send {
  padding: 0 13px;
  border: var(--x-line);
  border-radius: 12px;
  background: var(--x-orange);
  color: var(--x-ink);
  font-weight: 700;
}

.x-world-chat__send:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.x-world-chat__hint {
  padding-top: 7px;
  color: rgba(243, 238, 227, .55);
  font-size: .63rem;
  text-align: center;
}

.x-world-chat-pop-enter-active,
.x-world-chat-pop-leave-active {
  transition: opacity .2s, transform .25s var(--x-ease);
  transform-origin: bottom left;
}

.x-world-chat-pop-enter-from,
.x-world-chat-pop-leave-to {
  opacity: 0;
  transform: scale(.85) translateY(8px);
}

@media (prefers-reduced-motion: reduce) {

  .x-world-chat-pop-enter-active,
  .x-world-chat-pop-leave-active {
    transition: none;
  }
}
</style>
