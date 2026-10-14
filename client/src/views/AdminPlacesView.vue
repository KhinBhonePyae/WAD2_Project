<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { BASE_URL, authConfig } from '../utils/api.js'

const places = ref([])
const search = ref('')
const sortOrder = ref('az')
const loading = ref(true)

const totalPlaces = computed(() => places.value.length)
const openPlaces = computed(() => places.value.filter(place => place.openNow).length)
const closedPlaces = computed(() => places.value.filter(place => !place.openNow).length)

const filteredPlaces = computed(() => {
  const q = search.value.trim().toLowerCase()

  let result = places.value.filter(place => {
    if (!q) return true

    return (
      (place.name || '').toLowerCase().includes(q) ||
      (place.area || '').toLowerCase().includes(q) ||
      (place.address || '').toLowerCase().includes(q)
    )
  })

  return [...result].sort((a, b) => {
    const first = (a.name || '').toLowerCase()
    const second = (b.name || '').toLowerCase()

    return sortOrder.value === 'za'
      ? second.localeCompare(first)
      : first.localeCompare(second)
  })
})

function getPlacePhoto(place) {
  return place.photos?.[0] || place.photo || ''
}

async function loadPlaces() {
  loading.value = true

  try {
    const { data } = await axios.get(`${BASE_URL}/places`)
    places.value = data
  } catch (e) {
    console.error('Could not load places', e)
  } finally {
    loading.value = false
  }
}

async function deletePlace(place) {
  if (!confirm(`Delete ${place.name}?`)) return

  try {
    await axios.delete(`${BASE_URL}/places/${place.id}`, authConfig())
    places.value = places.value.filter(p => p.id !== place.id)
  } catch (e) {
    console.error('Could not delete place', e)
  }
}

onMounted(loadPlaces)
</script>

<template>
  <main class="container ss-section admin-page">
    <!-- HEADER -->
    <div class="admin-header">
      <div>
        <div class="admin-eyebrow">ADMIN · STUDY SPACES</div>
        <h1 class="mb-2">Manage Study Spaces</h1>
        <p class="ss-muted mb-0">
          Keep listings accurate, useful and ready for students.
        </p>
      </div>

      <RouterLink to="/admin/places/new" class="btn btn-primary admin-add-btn">
        + Add Study Space
      </RouterLink>
    </div>

    <!-- STATS -->
    <div class="admin-stats">
      <div class="admin-stat admin-stat-total">
        <span class="admin-stat-number">{{ totalPlaces }}</span>
        <span class="admin-stat-label">Total spaces</span>
      </div>

      <div class="admin-stat admin-stat-open">
        <span class="admin-stat-number">{{ openPlaces }}</span>
        <span class="admin-stat-label">Open</span>
      </div>

      <div class="admin-stat admin-stat-closed">
        <span class="admin-stat-number">{{ closedPlaces }}</span>
        <span class="admin-stat-label">Closed</span>
      </div>
    </div>

    <!-- SEARCH / SORT -->
    <div class="admin-toolbar">
      <div class="admin-search">
        <span class="admin-search-icon">⌕</span>
        <input v-model="search" type="text" placeholder="Search by name, area or address...">
      </div>

      <select v-model="sortOrder" class="form-select admin-sort">
        <option value="az">Name: A–Z</option>
        <option value="za">Name: Z–A</option>
      </select>
    </div>

    <!-- LOADING -->
    <div v-if="loading" class="admin-empty">
      Loading study spaces...
    </div>

    <!-- LIST -->
    <div v-else-if="filteredPlaces.length" class="admin-place-list">
      <article v-for="place in filteredPlaces" :key="place.id" class="admin-place-row">
        <!-- IMAGE -->
        <div class="admin-place-image">
          <img v-if="getPlacePhoto(place)" :src="getPlacePhoto(place)" :alt="`${place.name} preview`">

          <div v-else class="admin-place-image-fallback">
            📍
          </div>
        </div>

        <!-- INFO -->
        <div class="admin-place-info">
          <div class="admin-place-title-row">
            <h2 class="admin-place-name">{{ place.name }}</h2>

            <span class="admin-status" :class="place.openNow ? 'admin-status-open' : 'admin-status-closed'">
              {{ place.openNow ? '● Open' : '● Closed' }}
            </span>
          </div>

          <div class="admin-place-area">{{ place.area }}</div>

          <div class="admin-place-address">
            {{ place.address }}
          </div>

          <div class="admin-place-badges">
            <span class="admin-mini-badge">
              {{ place.indoor ? 'Indoor' : 'Outdoor' }}
            </span>

            <span v-if="place.capacity" class="admin-mini-badge">
              {{ place.capacity }} seats
            </span>

            <span v-if="place.hours" class="admin-mini-badge">
              {{ place.hours }}
            </span>
          </div>
        </div>

        <!-- ACTIONS -->
        <div class="admin-actions">
          <RouterLink :to="`/places/${place.id}`" class="btn btn-outline-primary btn-sm">
            View
          </RouterLink>

          <RouterLink :to="`/admin/places/${place.id}/edit`" class="btn btn-outline-primary btn-sm">
            Edit
          </RouterLink>

          <button class="btn btn-outline-danger btn-sm" @click="deletePlace(place)">
            Delete
          </button>
        </div>
      </article>
    </div>

    <!-- NO RESULTS -->
    <div v-else class="admin-empty">
      <strong>No study spaces found.</strong>
      <span v-if="search"> Try another search.</span>
    </div>
  </main>
</template>

<style scoped>
.admin-page {
  padding-top: 8.5rem !important;
  padding-bottom: 5rem;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  margin-bottom: 2rem;
}

.admin-eyebrow {
  display: inline-block;
  margin-bottom: .75rem;
  padding: .35rem .75rem;
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-butter);
  font-family: var(--x-mono);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .06em;
  box-shadow: 3px 3px 0 var(--x-ink);
}

.admin-header h1 {
  margin: 0;
  font-size: clamp(3rem, 6vw, 5rem);
}

.admin-add-btn {
  flex-shrink: 0;
  margin-bottom: .5rem;
}

/* STATS */
.admin-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.admin-stat {
  display: flex;
  flex-direction: column;
  padding: 1.1rem 1.25rem;
  border: 2px solid var(--x-ink);
  border-radius: 18px;
  box-shadow: 4px 4px 0 var(--x-ink);
}

.admin-stat-total {
  background: var(--x-sky);
}

.admin-stat-open {
  background: var(--x-lime);
}

.admin-stat-closed {
  background: #FFC9B8;
}

.admin-stat-number {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}

.admin-stat-label {
  margin-top: .4rem;
  font-size: .85rem;
  font-weight: 700;
}

/* TOOLBAR */
.admin-toolbar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.admin-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .15rem 1rem;
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-card);
  box-shadow: 4px 4px 0 var(--x-ink);
}

.admin-search-icon {
  font-size: 1.4rem;
  font-weight: 800;
}

.admin-search input {
  width: 100%;
  border: 0;
  outline: 0;
  padding: .8rem 0;
  background: transparent;
  color: var(--x-ink);
}

.admin-search input::placeholder {
  color: var(--x-muted);
}

.admin-search:focus-within {
  box-shadow: 6px 6px 0 var(--x-ink);
}

.admin-sort {
  width: 180px;
  flex-shrink: 0;
  border-radius: 999px;
  box-shadow: 4px 4px 0 var(--x-ink);
}

/* LIST */
.admin-place-list {
  overflow: hidden;
  border: 2px solid var(--x-ink);
  border-radius: 26px;
  background: var(--x-card);
  box-shadow: 6px 6px 0 var(--x-ink);
}

.admin-place-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) auto;
  align-items: center;
  gap: 1.25rem;
  min-height: 125px;
  padding: 1rem;
  border-bottom: 2px solid var(--x-ink);
  transition: background .2s ease;
}

.admin-place-row:last-child {
  border-bottom: 0;
}

.admin-place-row:hover {
  background: #FFF7EC;
}

.admin-place-image {
  width: 120px;
  height: 90px;
  overflow: hidden;
  border: 2px solid var(--x-ink);
  border-radius: 16px;
  background: var(--x-paper-2);
  box-shadow: 3px 3px 0 var(--x-ink);
}

.admin-place-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.admin-place-image-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 1.8rem;
}

.admin-place-info {
  min-width: 0;
}

.admin-place-title-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  flex-wrap: wrap;
}

.admin-place-name {
  margin: 0;
  font-size: 1.15rem !important;
  line-height: 1.2 !important;
  letter-spacing: -.02em !important;
}

.admin-status {
  display: inline-flex;
  align-items: center;
  padding: .2rem .55rem;
  border: 1.5px solid var(--x-ink);
  border-radius: 999px;
  font-size: .7rem;
  font-weight: 800;
}

.admin-status-open {
  background: var(--x-lime);
}

.admin-status-closed {
  background: #FFC9B8;
}

.admin-place-area {
  margin-top: .35rem;
  font-weight: 700;
  color: var(--x-ink-2);
}

.admin-place-address {
  margin-top: .15rem;
  color: var(--x-muted);
  font-size: .83rem;
}

.admin-place-badges {
  display: flex;
  gap: .4rem;
  flex-wrap: wrap;
  margin-top: .65rem;
}

.admin-mini-badge {
  padding: .2rem .55rem;
  border: 1px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-paper);
  font-size: .68rem;
  font-weight: 700;
}

.admin-actions {
  display: flex;
  gap: .65rem;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* EMPTY */
.admin-empty {
  padding: 3rem 1rem;
  border: 2px dashed var(--x-ink);
  border-radius: 24px;
  background: var(--x-card);
  text-align: center;
  color: var(--x-muted);
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .admin-place-row {
    grid-template-columns: 100px minmax(0, 1fr);
  }

  .admin-place-image {
    width: 100px;
    height: 80px;
  }

  .admin-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    padding-top: .5rem;
  }
}

@media (max-width: 650px) {
  .admin-page {
    padding-top: 9rem !important;
  }

  .admin-header {
    align-items: stretch;
    flex-direction: column;
    gap: 1.25rem;
  }

  .admin-add-btn {
    align-self: flex-start;
  }

  .admin-stats {
    grid-template-columns: 1fr;
  }

  .admin-toolbar {
    flex-direction: column;
  }

  .admin-sort {
    width: 100%;
  }

  .admin-place-row {
    grid-template-columns: 80px minmax(0, 1fr);
    gap: .9rem;
  }

  .admin-place-image {
    width: 80px;
    height: 70px;
  }

  .admin-actions {
    justify-content: flex-start;
  }
}
</style>