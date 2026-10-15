<script setup>
const props = defineProps({ options: Array, selected: Array })
const emit = defineEmits(['toggle'])
</script>

<template>
  <div class="d-flex flex-wrap gap-2">
    <button v-for="opt in options" :key="opt.value" class="ss-chip" type="button"
      :aria-pressed="selected.includes(opt.value)" :data-test="'chip-' + opt.value" @click="$emit('toggle', opt.value)">
      {{ opt.label }}
    </button>
  </div>
</template>
