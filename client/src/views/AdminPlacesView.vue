<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const places = ref([])

async function loadPlaces() {
  try {
    const { data } = await axios.get(`${BASE_URL}/places`)
    places.value = data
  } catch (e) {
    console.error('Could not load places', e)
  }
}

async function deletePlace(place) {
  if (!confirm(`Delete ${place.name}?`)) return

  try {
    await axios.delete(`${BASE_URL}/places/${place.id}`)
    places.value = places.value.filter(p => p.id !== place.id)
  } catch (e) {
    console.error('Could not delete place', e)
  }
}

onMounted(loadPlaces)
</script>

<template>
  <main class="container ss-section">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1 class="mb-1">Manage Study Spaces</h1>
        <p class="ss-muted mb-0">Add, edit or delete study spaces.</p>
      </div>

      <RouterLink to="/admin/places/new" class="btn btn-primary">
        Add Study Space
      </RouterLink>
    </div>

    <div v-if="places.length" class="ss-card">
      <div v-for="place in places" :key="place.id"
           class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 p-3 border-bottom">

        <div>
          <strong>{{ place.name }}</strong>
          <div class="ss-muted">{{ place.area }}</div>
          <div class="ss-meta">{{ place.address }}</div>
        </div>

        <div class="d-flex gap-2">
          <RouterLink :to="`/places/${place.id}`"
                      class="btn btn-outline-primary btn-sm">
            View
          </RouterLink>

          <RouterLink :to="`/admin/places/${place.id}/edit`"
                      class="btn btn-outline-primary btn-sm">
            Edit
          </RouterLink>

          <button class="btn btn-outline-danger btn-sm"
                  @click="deletePlace(place)">
            Delete
          </button>
        </div>

      </div>
    </div>

    <div v-else class="ss-empty">
      No study spaces found.
    </div>
  </main>
</template>