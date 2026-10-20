<script setup>
import { computed } from 'vue'

const props = defineProps({ value: Number, count: Number })
const stars = computed(() => {
  const full = Math.round(props.value || 0)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
})
</script>

<template>
  <!-- a place with no reviews says so, instead of showing five empty stars and 0.0 -->
  <span v-if="count === 0" class="ss-meta" data-test="stars">No reviews yet</span>
  <span v-else class="ss-stars" data-test="stars">
    {{ stars }}
    <span class="ss-meta" v-if="count !== undefined">{{ (value || 0).toFixed(1) }} ({{ count }})</span>
  </span>
</template>
