<script setup>
import { computed } from 'vue'
import { scoreBand } from '../utils/suitability.js'

const props = defineProps({ score: Number })
const band = computed(() => scoreBand(props.score))
</script>

<template>
  <span class="ss-score" :class="'ss-score--' + band" :style="{ '--ss-score': score }"
    :title="'Suitability ' + score + ' out of 100'" data-test="score">
    <span class="ss-score__val">{{ score }}</span>
  </span>
</template>
