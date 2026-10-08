<script setup>
import { computed } from 'vue'

const props = defineProps({ value: Number, count: Number })
const stars = computed(() => {
  const full = Math.round(props.value || 0)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
})
</script>

<template>
  <span class="ss-stars" data-test="stars">
    {{ stars }}
    <span class="ss-meta" v-if="count !== undefined">{{ (value || 0).toFixed(1) }} ({{ count }})</span>
  </span>
</template>
