<script setup>
defineProps({ weather: Object, area: String })
</script>

<template>
  <div class="ss-weather" v-if="weather" data-test="weather">
    <span class="ss-weather__icon">{{ weather.icon }}</span>
    <div>
      <strong>{{ weather.label }} in {{ area || 'Singapore' }} — {{ weather.temp }}°C</strong>
      <div class="ss-meta">
        {{ weather.raining
            ? 'Outdoor spots are ranked lower right now.'
            : 'Good conditions for outdoor spots.' }}
      </div>
    </div>
  </div>
</template>
