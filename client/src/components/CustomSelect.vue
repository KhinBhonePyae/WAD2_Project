<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] } // Array of { value, label }
})
const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const wrapper = ref(null)

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue)
  return opt ? opt.label : (props.options[0]?.label || 'Select...')
})

function toggle() {
  isOpen.value = !isOpen.value
}

function select(opt) {
  emit('update:modelValue', opt.value)
  isOpen.value = false
}

// Close when clicking outside
function handleClickOutside(e) {
  if (wrapper.value && !wrapper.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="custom-select" ref="wrapper">
    <!-- The Box you click -->
    <button type="button" class="ss-select-trigger" @click="toggle" :class="{ 'is-open': isOpen }">
      <span>{{ selectedLabel }}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="chevron">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <!-- The Dropdown List -->
    <Transition name="dropdown">
      <ul v-if="isOpen" class="ss-select-menu" @wheel.stop>
        <li v-for="opt in options" :key="opt.value" 
            class="ss-select-item" 
            :class="{ 'is-active': opt.value === modelValue }"
            @click="select(opt)">
          {{ opt.label }}
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.custom-select {
  position: relative;
  width: 100%;
  user-select: none;
}

.ss-select-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--x-card, #fff);
  border: 2px solid var(--x-ink, #111);
  border-radius: 12px;
  padding: 0.6rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--x-ink, #111);
  box-shadow: 2px 2px 0 var(--x-ink, #111);
  transition: all 0.2s ease;
  cursor: pointer;
}

.ss-select-trigger:hover,
.ss-select-trigger.is-open {
  box-shadow: 4px 4px 0 var(--x-ink, #111);
  transform: translate(-2px, -2px);
}

.chevron {
  transition: transform 0.2s ease;
}
.is-open .chevron {
  transform: rotate(180deg);
}

.ss-select-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 1050;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--ss-surface, var(--x-card, #fff));
  border: 2px solid var(--x-ink, #111);
  border-radius: 18px;
  box-shadow: var(--x-pop, 4px 4px 0 #111);
  max-height: 250px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ss-select-menu::-webkit-scrollbar {
  width: 10px;
  -webkit-appearance: none;
}
.ss-select-menu::-webkit-scrollbar-track {
  background: transparent;
  margin-block: 10px;
}
.ss-select-menu::-webkit-scrollbar-thumb {
  background-color: var(--x-ink, #111);
  border-radius: 10px;
  border: 3px solid transparent;
  background-clip: content-box;
}

.ss-select-item {
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: background 0.15s ease;
}

.ss-select-item:hover {
  background: var(--ss-purple-100, var(--x-paper));
}

.ss-select-item.is-active {
  background: var(--x-ink, #111);
  color: var(--x-card, #fff);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>