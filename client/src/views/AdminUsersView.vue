<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const router = useRouter()
const users = ref([])
const loading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const updatingId = ref(null)

const search = ref('')
const roleFilter = ref('all')
const currentPage = ref(1)
const perPage = 10

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase()

  return users.value.filter(user => {
    const matchesSearch =
      !term ||
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)

    const matchesRole =
      roleFilter.value === 'all' ||
      user.role === roleFilter.value

    return matchesSearch && matchesRole
  })
})

const totalPages = computed(() =>
  Math.ceil(filteredUsers.value.length / perPage)
)

const startIndex = computed(() =>
  (currentPage.value - 1) * perPage
)

const endIndex = computed(() =>
  Math.min(startIndex.value + perPage, filteredUsers.value.length)
)

const paginatedUsers = computed(() =>
  filteredUsers.value.slice(startIndex.value, endIndex.value)
)

watch([search, roleFilter], () => {
  currentPage.value = 1
})

async function getUsers() {
  const token = localStorage.getItem('token')

  try {
    const response = await axios.get(`${BASE_URL}/users/admin`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    users.value = response.data.users
  } catch (error) {
    handleError(error, 'Unable to load users.')
  } finally {
    loading.value = false
  }
}

async function updateRole(user, newRole) {
  if (newRole === user.role) return

  const token = localStorage.getItem('token')
  errorMessage.value = ''
  successMessage.value = ''

  try {
    updatingId.value = user._id

    const response = await axios.put(
      `${BASE_URL}/users/admin/${user._id}/role`,
      { role: newRole },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    user.role = response.data.user.role
    successMessage.value = 'User role updated successfully.'

    const currentUser = JSON.parse(localStorage.getItem('user'))

    if (currentUser?._id === user._id) {
      currentUser.role = newRole
      localStorage.setItem('user', JSON.stringify(currentUser))
      window.dispatchEvent(new Event('user-login'))

      if (newRole !== 'admin') router.push('/places')
    }
  } catch (error) {
    handleError(error, 'Unable to update user role.')
  } finally {
    updatingId.value = null
  }
}

function changePage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

function formatDate(date) {
  if (!date) return '-'

  return new Date(date).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function handleError(error, message) {
  if (error.response?.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('user-login'))
    router.push('/login')
    return
  }

  if (error.response?.status === 403) {
    router.push('/places')
    return
  }

  errorMessage.value = error.response?.data?.error || message
}

onMounted(getUsers)
</script>

<template>
  <main class="users-page">
    <div class="container users-container">

      <div class="page-heading">
        <div>
          <p class="page-label">ADMIN</p>
          <h1>Users</h1>
        </div>

        <span v-if="!loading" class="user-count">
          {{ users.length }} users
        </span>
      </div>

      <div v-if="successMessage" class="alert alert-success">
        {{ successMessage }}
      </div>

      <div v-if="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <div v-if="loading" class="loading-state">
        <div class="spinner-border text-primary"></div>
        <span>Loading users...</span>
      </div>

      <template v-else>

        <div class="controls">
          <div class="search-box">
            <span class="search-icon">⌕</span>
            <input
              v-model="search"
              type="text"
              placeholder="Search by name or email..."
            >
          </div>

          <select v-model="roleFilter" class="filter-select">
            <option value="all">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        <div class="table-wrapper">
          <table class="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Role</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="user in paginatedUsers" :key="user._id">
                <td class="user-name">
                  <span class="avatar">
                    {{ user.name.charAt(0).toUpperCase() }}
                  </span>

                  {{ user.name }}
                </td>

                <td>{{ user.email }}</td>
                <td>{{ formatDate(user.createdAt) }}</td>

                <td>
                  <select
                    class="role-select"
                    :class="user.role"
                    :value="user.role"
                    :disabled="updatingId === user._id"
                    @change="updateRole(user, $event.target.value)"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>

              <tr v-if="filteredUsers.length === 0">
                <td colspan="4" class="empty-row">
                  No users found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="filteredUsers.length > 0"
          class="pagination-section"
        >
          <p>
            Showing {{ startIndex + 1 }}–{{ endIndex }}
            of {{ filteredUsers.length }} users
          </p>

          <div
            v-if="totalPages > 1"
            class="pagination-buttons"
          >
            <button
              class="page-button arrow"
              :disabled="currentPage === 1"
              @click="changePage(currentPage - 1)"
            >
              ‹
            </button>

            <button
              v-for="page in totalPages"
              :key="page"
              class="page-button"
              :class="{ active: currentPage === page }"
              @click="changePage(page)"
            >
              {{ page }}
            </button>

            <button
              class="page-button arrow"
              :disabled="currentPage === totalPages"
              @click="changePage(currentPage + 1)"
            >
              ›
            </button>
          </div>
        </div>

      </template>
    </div>
  </main>
</template>

<style scoped>
.users-page {
  min-height: calc(100vh - 140px);
  padding: 7rem 1rem 3rem;
  background: var(--x-card);
}

.users-container {
  max-width: 1100px;
}

.page-heading {
  margin-bottom: 2rem;
  padding: 1.5rem 1.8rem;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--x-ink);
  border-radius: 20px;
  background: var(--x-lilac);
  box-shadow: 7px 7px 0 var(--x-ink);
}

.page-label {
  margin-bottom: .35rem;
  color: var(--x-ink);
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .13em;
}

.page-heading h1 {
  margin: 0;
  color: var(--x-ink);
  font-size: 2.2rem;
  font-weight: 800;
}

.user-count {
  padding: .45rem .9rem;
  border: 1px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-lime);
  color: var(--x-ink);
  font-size: .9rem;
  font-weight: 800;
}

.controls {
  margin-bottom: 1.8rem;
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 1rem;
}

.search-box {
  min-height: 58px;
  padding: 0 1.2rem;
  display: flex;
  align-items: center;
  gap: .8rem;
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  background: white;
  box-shadow: 6px 6px 0 var(--x-ink);
}

.search-icon {
  color: var(--x-ink);
  font-size: 1.6rem;
  font-weight: 700;
}

.search-box input {
  width: 100%;
  border: none;
  outline: none;
  color: var(--x-ink);
  font-size: 1rem;
  background: transparent;
}

.filter-select {
  min-height: 58px;
  padding: 0 1.2rem;
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  color: var(--x-ink);
  font-size: 1rem;
  font-weight: 700;
  background: white;
  box-shadow: 6px 6px 0 var(--x-ink);
}

.filter-select:focus {
  outline: none;
}

.loading-state {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.table-wrapper {
  overflow-x: auto;
  border: 2px solid var(--x-ink);
  border-radius: 22px;
  background: white;
  box-shadow: 9px 9px 0 var(--x-ink);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 1rem 1.2rem;
  text-align: left;
  border-bottom: 1px solid var(--x-paper);
  color: var(--x-ink);
}

.users-table th {
  background: var(--x-orange);
  color: var(--x-ink);
  font-size: .8rem;
  font-weight: 800;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.users-table tbody tr {
  transition: background .2s ease;
}

.users-table tbody tr:hover {
  background: var(--x-card);
}

.users-table tbody tr:last-child td {
  border-bottom: none;
}

.user-name {
  display: flex;
  align-items: center;
  gap: .75rem;
  font-weight: 700;
}

.avatar {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--x-ink);
  border-radius: 50%;
  background: var(--x-lime);
  font-weight: 800;
}

.role-select {
  min-width: 110px;
  padding: .5rem .75rem;
  border: 1px solid var(--x-ink);
  border-radius: 999px;
  color: var(--x-ink);
  font-weight: 800;
  cursor: pointer;
}

.role-select.user {
  background: var(--x-lime);
}

.role-select.admin {
  background: var(--x-orange);
}

.role-select:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--x-lilac);
}

.empty-row {
  padding: 3rem !important;
  text-align: center !important;
  color: var(--x-muted) !important;
}

.pagination-section {
  margin-top: 3rem;
  text-align: center;
}

.pagination-section p {
  margin-bottom: 1.2rem;
  color: var(--x-muted);
  font-size: 1rem;
  font-weight: 700;
}

.pagination-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .8rem;
  flex-wrap: wrap;
}

.page-button {
  width: 56px;
  height: 56px;
  border: 2px solid var(--x-ink);
  border-radius: 50%;
  background: white;
  color: var(--x-ink);
  font-size: 1.1rem;
  font-weight: 800;
  box-shadow: 5px 5px 0 var(--x-ink);
  transition: .15s ease;
}

.page-button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.page-button.active {
  background: var(--x-orange);
}

.page-button.arrow {
  font-size: 1.8rem;
}

.page-button:disabled {
  opacity: .3;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 575px) {
  .controls {
    grid-template-columns: minmax(0, 1fr) 140px;
  }

  .search-box,
  .filter-select {
    min-height: 50px;
  }

  .filter-select {
    padding: 0 .8rem;
  }
}

@media (max-width: 575px) {
  .users-page {
    padding: 6rem .75rem 2rem;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-heading h1 {
    font-size: 1.8rem;
  }

  .users-table th,
  .users-table td {
    padding: .8rem;
  }

  .page-button {
    width: 46px;
    height: 46px;
  }
}
</style>