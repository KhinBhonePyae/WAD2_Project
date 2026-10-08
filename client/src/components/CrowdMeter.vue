<script setup>
import { computed } from 'vue'

const props = defineProps({ level: String })
const label = computed(() => {
  if (props.level === 'quiet') return 'Quiet'
  if (props.level === 'moderate') return 'Moderate'
  if (props.level === 'packed') return 'Packed'
  return 'No reports'
})
</script>

<template>
  <span class="ss-crowd" :class="level ? 'ss-crowd--' + level : ''" data-test="crowd">
    <span class="ss-crowd__dots">
      <i class="ss-crowd__dot"></i><i class="ss-crowd__dot"></i><i class="ss-crowd__dot"></i>
    </span>
    {{ label }}
  </span>
</template>
