<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import PlaceCard from '../components/PlaceCard.vue'

const router = useRouter()
const savedPlaces = ref([])
const savedIds = ref([])
const loading = ref(true)
const errorMessage = ref('')

async function getSavedPlaces() {
  const token = localStorage.getItem('token')

  if (!token) {
    router.push('/login')
    return
  }

  try {
    const savedResponse = await axios.get(
      `${BASE_URL}/saved`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    savedIds.value = savedResponse.data.savedPlaceIds

    const requests = savedIds.value.map(id =>
      axios.get(`${BASE_URL}/places/${id}`)
    )

    const responses = await Promise.all(requests)

    savedPlaces.value = responses.map(
      response => response.data
    )
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      router.push('/login')
      return
    }

    errorMessage.value = 'Unable to load saved places.'
  } finally {
    loading.value = false
  }
}

async function toggleSave(placeId) {
  const token = localStorage.getItem('token')

  try {
    await axios.delete(
      `${BASE_URL}/saved/${placeId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    savedIds.value = savedIds.value.filter(
      id => id !== placeId
    )

    savedPlaces.value = savedPlaces.value.filter(
      place => place.id !== placeId
    )
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      router.push('/login')
      return
    }

    errorMessage.value = 'Unable to remove saved place.'
  }
}

onMounted(() => {
  getSavedPlaces()
})
</script>

<template>
  <main class="saved-page">
    <div class="container saved-container">
      <div class="saved-heading">
        <div>
          <p class="saved-label">MY PLACES</p>
          <h1>Saved Places</h1>
        </div>

        <span
          v-if="!loading"
          class="saved-count"
        >
          {{ savedPlaces.length }}
          saved
        </span>
      </div>

      <div
        v-if="loading"
        class="saved-state"
      >
        <div class="spinner-border text-primary"></div>
        <span>Loading saved places...</span>
      </div>

      <div
        v-else-if="errorMessage"
        class="alert alert-danger"
      >
        {{ errorMessage }}
      </div>

      <div
        v-else-if="savedPlaces.length === 0"
        class="empty-card"
      >
        <h2>No saved places yet</h2>

        <p>
          Save a study spot by clicking the heart
          on a place card.
        </p>

        <RouterLink
          to="/places"
          class="btn browse-button"
        >
          Browse Places
        </RouterLink>
      </div>

      <div
        v-else
        class="saved-grid"
      >
        <PlaceCard
          v-for="place in savedPlaces"
          :key="place.id"
          :place="place"
          :saved="true"
          @toggle-save="toggleSave"
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.saved-page {
  min-height: calc(100vh - 140px);
  padding: 3rem 1rem;
  background: #f7f8fb;
}

.saved-container {
  max-width: 1200px;
}

.saved-heading {
  margin-bottom: 2rem;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.saved-label {
  margin-bottom: .35rem;
  color: #4b78b8;
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .13em;
}

.saved-heading h1 {
  margin: 0;
  color: #171c2a;
  font-size: 2.2rem;
  font-weight: 800;
}

.saved-count {
  padding: .45rem .9rem;
  border-radius: 999px;
  background: #e9eef8;
  color: #315e91;
  font-size: .9rem;
  font-weight: 700;
}

.saved-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.saved-state,
.empty-card {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
}

.empty-card {
  padding: 2.5rem;
  border: 1px solid #dfe4ec;
  border-radius: 24px;
  background: white;
}

.empty-card h2 {
  margin: 0;
  color: #171c2a;
  font-size: 1.5rem;
  font-weight: 800;
}

.empty-card p {
  max-width: 420px;
  margin: 0;
  color: #697386;
}

.browse-button {
  padding: .7rem 1.3rem;
  border-radius: 12px;
  color: white;
  font-weight: 700;
  background: #4b7fc1;
}

.browse-button:hover {
  color: white;
  background: #3f70ae;
}

@media (max-width: 991px) {
  .saved-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 575px) {
  .saved-page {
    padding: 2rem .75rem;
  }

  .saved-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .saved-heading h1 {
    font-size: 1.8rem;
  }

  .saved-grid {
    grid-template-columns: 1fr;
  }
}
</style>