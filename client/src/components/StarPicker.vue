<script setup>
/* Owner: Jeffrey Wen. Tap-to-rate stars (1-5) for writing and editing reviews.
 * Works like a radio group: arrow keys move the rating, hover previews it. */
import { ref, computed } from 'vue'

const props = defineProps({ modelValue: Number, label: String })
const emit = defineEmits(['update:modelValue'])

const hover = ref(0)
const shown = computed(() => hover.value || props.modelValue || 0)
const WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

function pick(n) {
  emit('update:modelValue', n)
}

function onKey(event) {
  const current = props.modelValue || 0
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); pick(Math.min(5, current + 1)) }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); pick(Math.max(1, current - 1)) }
}
</script>

<template>
  <div class="star-picker" role="radiogroup" :aria-label="label || 'Rating'" data-test="star-picker"
    @mouseleave="hover = 0" @keydown="onKey">
    <button v-for="n in 5" :key="n" type="button" class="star" :class="{ on: n <= shown }" role="radio"
      :aria-checked="modelValue === n" :aria-label="n + (n === 1 ? ' star' : ' stars')"
      :tabindex="(modelValue || 1) === n ? 0 : -1" :data-test="'star-' + n"
      @mouseenter="hover = n" @click="pick(n)">★</button>
    <span class="star-word" aria-hidden="true">{{ WORDS[shown] }}</span>
  </div>
</template>

<style scoped>
.star-picker {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.star {
  padding: 0 2px;
  border: 0;
  background: none;
  font-size: 1.9rem;
  line-height: 1;
  color: rgba(21, 19, 15, .2);
  cursor: pointer;
  transition: transform .15s ease, color .15s ease;
}

.star.on { color: #f5b400; }
.star:hover { transform: scale(1.15); }
.star:focus-visible { outline: 2px solid var(--x-ink); outline-offset: 2px; border-radius: 6px; }

.star-word {
  margin-left: .5rem;
  min-width: 5.5rem;
  font-weight: 700;
  font-size: .9rem;
}

@media (prefers-reduced-motion: reduce) {
  .star { transition: none; }
  .star:hover { transform: none; }
}
</style>
