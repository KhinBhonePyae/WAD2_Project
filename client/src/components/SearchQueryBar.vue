<script setup>
import { ref, watch } from 'vue'

const props = defineProps({ modelValue: String })
const emit = defineEmits(['update:modelValue', 'search'])

const text = ref(props.modelValue || '')
watch(() => props.modelValue, (v) => (text.value = v || ''))

function submit() {
  emit('update:modelValue', text.value.trim())
  emit('search')
}
</script>

<template>
  <div class="input-group mb-3">
    <input
      type="text"
      class="form-control"
      placeholder="Search by name, area or address…"
      v-model="text"
      @keyup.enter="submit"
      data-test="search-input"
    />
    <button class="btn btn-primary" @click="submit" data-test="search-button">Search</button>
  </div>
</template>