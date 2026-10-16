<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL, authConfig } from '../utils/api.js'

const router = useRouter()

const users = ref([])
const loading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const updatingId = ref(null)
const deletingId = ref(null)

const search = ref('')
const roleFilter = ref('all')
const currentPage = ref(1)
const perPage = 10

const deleteTarget = ref(null)

let successTimer = null

function showSuccess(message) {
  successMessage.value = message

  if (successTimer) clearTimeout(successTimer)

  successTimer = setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

const currentUser = ref(getStoredUser())

function isSelf(user) {
  return String(currentUser.value?._id) === String(user._id)
}

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

watch(totalPages, pages => {
  if (currentPage.value > pages) {
    currentPage.value = Math.max(pages, 1)
  }
})

function clearMessages() {
  errorMessage.value = ''
  successMessage.value = ''

  if (successTimer) {
    clearTimeout(successTimer)
    successTimer = null
  }
}

async function getUsers() {
  try {
    const response = await axios.get(
      `${BASE_URL}/users/admin`,
      authConfig()
    )

    users.value = response.data.users
  } catch (error) {
    handleError(error, 'Unable to load users.')
  } finally {
    loading.value = false
  }
}

async function updateRole(user, newRole) {
  if (newRole === user.role || isSelf(user)) return

  clearMessages()

  try {
    updatingId.value = user._id

    const response = await axios.put(
      `${BASE_URL}/users/admin/${user._id}/role`,
      { role: newRole },
      authConfig()
    )

    user.role = response.data.user.role

    showSuccess(
      `${user.name}'s role was updated to ${user.role}.`
    )
  } catch (error) {
    handleError(error, 'Unable to update user role.')
  } finally {
    updatingId.value = null
  }
}

/* OPEN DELETE MODAL */
function askDeleteUser(user) {
  if (isSelf(user)) return

  clearMessages()
  deleteTarget.value = user
}

/* CLOSE DELETE MODAL */
function closeDeleteModal() {
  if (deletingId.value) return
  deleteTarget.value = null
}

/* ACTUAL DELETE */
async function confirmDeleteUser() {
  if (!deleteTarget.value) return

  const user = deleteTarget.value

  clearMessages()

  try {
    deletingId.value = user._id

    const response = await axios.delete(
      `${BASE_URL}/users/admin/${user._id}`,
      authConfig()
    )

    users.value = users.value.filter(
      item => item._id !== user._id
    )

    deleteTarget.value = null

    showSuccess(
      response.data.message ||
      `${user.name}'s account was deleted successfully.`
    )
  } catch (error) {
    handleError(error, 'Unable to delete user.')
  } finally {
    deletingId.value = null
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

  errorMessage.value =
    error.response?.data?.error || message
}

onMounted(getUsers)

onUnmounted(() => {
  if (successTimer) clearTimeout(successTimer)
})
</script>

<template>
  <main class="users-page">
    <div class="container users-container">
      <div class="page-heading">
        <div>
          <p class="page-label">ADMIN</p>
          <h1>Users</h1>
          <p class="page-description">Manage user roles or remove accounts. Your own admin account is protected.</p>
        </div>
        <span v-if="!loading" class="user-count">{{ users.length }} users</span>
      </div>

      <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
      <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

      <div v-if="loading" class="loading-state">
        <div class="spinner-border text-primary"></div>
        <span>Loading users...</span>
      </div>

      <template v-else>
        <div class="controls">
          <div class="search-box">
            <span class="search-icon">⌕</span>
            <input v-model="search" type="text" placeholder="Search by name or email...">
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
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="user in paginatedUsers" :key="user._id" class="user-row">
                <td class="user-name-cell" data-label="Name">
                  <div class="user-name-wrap">
                    <span class="avatar">{{ user.name.charAt(0).toUpperCase() }}</span>
                    <div class="name-line">
                      <span>{{ user.name }}</span>
                      <span v-if="isSelf(user)" class="you-badge">You</span>
                    </div>
                  </div>
                </td>

                <td class="email-cell" data-label="Email">{{ user.email }}</td>
                <td data-label="Joined">{{ formatDate(user.createdAt) }}</td>

                <td data-label="Role">
                  <select class="role-select" :class="user.role" :value="user.role" :disabled="updatingId === user._id || isSelf(user)" @change="updateRole(user, $event.target.value)">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>

                <td data-label="Actions">
                  <div v-if="!isSelf(user)" class="action-buttons">
                    <button class="action-btn delete-btn" type="button" :disabled="deletingId === user._id" @click="askDeleteUser(user)">Delete</button>
                  </div>
                  <span v-else class="protected-text">Protected</span>
                </td>
              </tr>

              <tr v-if="filteredUsers.length === 0">
                <td colspan="5" class="empty-row">No users found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredUsers.length > 0" class="pagination-section">
          <p>Showing {{ startIndex + 1 }}–{{ endIndex }} of {{ filteredUsers.length }} users</p>

          <div v-if="totalPages > 1" class="pagination-buttons">
            <button class="page-button arrow" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">‹</button>
            <button v-for="page in totalPages" :key="page" class="page-button" :class="{ active: currentPage === page }" @click="changePage(page)">{{ page }}</button>
            <button class="page-button arrow" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">›</button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="deleteTarget" class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-user-title" @click.self="closeDeleteModal">
      <div class="confirm-card">
        <div class="confirm-heading">
          <div>
            <p class="confirm-eyebrow">ACCOUNT MANAGEMENT</p>
            <h2 id="delete-user-title">Delete account</h2>
            <p class="confirm-subtitle">{{ deleteTarget.name }}</p>
          </div>

          <button class="confirm-close" type="button" :disabled="deletingId === deleteTarget._id" aria-label="Close" @click="closeDeleteModal">×</button>
        </div>

        <div class="confirm-warning">
          <strong>Delete this account?</strong>
          <p>{{ deleteTarget.name }} will no longer be able to log in. This action cannot be undone.</p>

          <div class="confirm-actions">
            <button type="button" class="confirm-cancel" :disabled="deletingId === deleteTarget._id" @click="closeDeleteModal">Cancel</button>
            <button type="button" class="confirm-delete" :disabled="deletingId === deleteTarget._id" @click="confirmDeleteUser">{{ deletingId === deleteTarget._id ? 'Deleting...' : 'Delete account' }}</button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.users-page {
  min-height:calc(100vh - 140px);
  padding:7rem 1rem 3rem;
}

.users-container { max-width:1180px; }

/* HEADER */
.page-heading {
  margin-bottom:1.5rem;
  padding:1.5rem 1.8rem;
  display:flex;
  align-items:end;
  justify-content:space-between;
  gap:1rem;
  border:1px solid var(--x-ink);
  border-radius:20px;
  background:var(--x-lilac);
  box-shadow:7px 7px 0 var(--x-ink);
}

.page-label {
  margin-bottom:.35rem;
  color:var(--x-ink);
  font-size:.78rem;
  font-weight:800;
  letter-spacing:.13em;
}

.page-heading h1 {
  margin:0;
  color:var(--x-ink);
  font-family:var(--x-display);
  font-size:clamp(3rem,7vw,5.5rem);
  font-weight:900;
  line-height:.95;
  letter-spacing:-.05em;
}

.page-description {
  max-width:720px;
  margin:.65rem 0 0;
  color:var(--x-muted);
  font-size:1rem;
  font-weight:500;
}

.user-count {
  min-width:110px;
  height:48px;
  padding:0 1rem;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
  white-space:nowrap;
  border:1px solid var(--x-ink);
  border-radius:999px;
  background:var(--x-lime);
  color:var(--x-ink);
  font-size:.9rem;
  font-weight:800;
}

/* NOTE */
.admin-note-text {
  margin-bottom:1.5rem;
  color:var(--x-muted);
  font-size:.9rem;
}

/* CONTROLS */
.controls {
  margin-bottom:1.8rem;
  display:grid;
  grid-template-columns:minmax(0,1fr) 260px;
  gap:1rem;
}

.search-box {
  min-height:58px;
  padding:0 1.2rem;
  display:flex;
  align-items:center;
  gap:.8rem;
  border:2px solid var(--x-ink);
  border-radius:999px;
  background:white;
  box-shadow:6px 6px 0 var(--x-ink);
}

.search-icon {
  color:var(--x-ink);
  font-size:1.6rem;
  font-weight:700;
}

.search-box input {
  width:100%;
  min-width:0;
  border:none;
  outline:none;
  color:var(--x-ink);
  font-size:1rem;
  background:transparent;
}

.filter-select {
  min-height:58px;
  padding:0 1.2rem;
  border:2px solid var(--x-ink);
  border-radius:999px;
  color:var(--x-ink);
  font-size:1rem;
  font-weight:700;
  background:white;
  box-shadow:6px 6px 0 var(--x-ink);
}

.filter-select:focus { outline:none; }

/* LOADING */
.loading-state {
  min-height:300px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:1rem;
}

/* TABLE */
.table-wrapper {
  border:2px solid var(--x-ink);
  border-radius:22px;
  background:white;
  box-shadow:9px 9px 0 var(--x-ink);
  overflow:hidden;
}

.users-table {
  width:100%;
  border-collapse:collapse;
}

.users-table th,
.users-table td {
  padding:1rem 1.1rem;
  text-align:left;
  vertical-align:middle;
  border-bottom:1px solid var(--x-paper);
  color:var(--x-ink);
}

.users-table th {
  background:var(--x-orange);
  color:var(--x-ink);
  font-size:.8rem;
  font-weight:800;
  letter-spacing:.05em;
  text-transform:uppercase;
}

.users-table tbody tr { transition:background .2s ease; }
.users-table tbody tr:hover { background:var(--x-card); }
.users-table tbody tr:last-child td { border-bottom:none; }

/* USER */
.user-name-wrap {
  display:flex;
  align-items:center;
  gap:.75rem;
  font-weight:700;
}

.avatar {
  width:36px;
  height:36px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
  border:1px solid var(--x-ink);
  border-radius:50%;
  background:var(--x-lime);
  font-weight:800;
}

.name-line {
  display:flex;
  align-items:center;
  gap:.45rem;
  flex-wrap:wrap;
}

.you-badge {
  padding:.16rem .45rem;
  border:1px solid var(--x-ink);
  border-radius:999px;
  background:var(--x-lilac);
  font-size:.64rem;
  font-weight:800;
  text-transform:uppercase;
}

.email-cell { overflow-wrap:anywhere; }

/* ROLE */
.role-select {
  min-width:110px;
  padding:.5rem .75rem;
  border:1px solid var(--x-ink);
  border-radius:999px;
  color:var(--x-ink);
  font-weight:800;
  cursor:pointer;
}

.role-select.user { background:var(--x-lime); }
.role-select.admin { background:var(--x-orange); }

.role-select:focus {
  outline:none;
  box-shadow:0 0 0 3px var(--x-lilac);
}

.role-select:disabled {
  opacity:.72;
  cursor:not-allowed;
}

/* ACTIONS */
.action-buttons {
  display:flex;
  align-items:center;
  gap:.55rem;
  flex-wrap:wrap;
}

.action-btn {
  padding:.45rem .8rem;
  border:1px solid var(--x-ink);
  border-radius:999px;
  color:var(--x-ink);
  font-size:.78rem;
  font-weight:800;
  box-shadow:3px 3px 0 var(--x-ink);
  transition:.15s ease;
}

.action-btn:hover:not(:disabled) {
  transform:translate(-1px,-1px);
  box-shadow:4px 4px 0 var(--x-ink);
}

.action-btn:disabled {
  opacity:.5;
  cursor:not-allowed;
}

.delete-btn { background:#ffc9b8; }

.protected-text {
  color:var(--x-muted);
  font-size:.78rem;
  font-weight:700;
}

.empty-row {
  padding:3rem !important;
  text-align:center !important;
  color:var(--x-muted) !important;
}

/* PAGINATION */
.pagination-section {
  margin-top:3rem;
  text-align:center;
}

.pagination-section p {
  margin-bottom:1.2rem;
  color:var(--x-muted);
  font-size:1rem;
  font-weight:700;
}

.pagination-buttons {
  display:flex;
  align-items:center;
  justify-content:center;
  gap:.8rem;
  flex-wrap:wrap;
}

.page-button {
  width:56px;
  height:56px;
  border:2px solid var(--x-ink);
  border-radius:50%;
  background:white;
  color:var(--x-ink);
  font-size:1.1rem;
  font-weight:800;
  box-shadow:5px 5px 0 var(--x-ink);
  transition:.15s ease;
}

.page-button:hover:not(:disabled) { transform:translateY(-2px); }
.page-button.active { background:var(--x-orange); }
.page-button.arrow { font-size:1.8rem; }

.page-button:disabled {
  opacity:.3;
  cursor:not-allowed;
  box-shadow:none;
}

/* CONFIRM MODAL */
.confirm-overlay {
  position:fixed;
  inset:0;
  z-index:3000;
  padding:1rem;
  display:grid;
  place-items:center;
  background:rgba(20,18,15,.48);
  backdrop-filter:blur(5px);
}

.confirm-card {
  width:min(700px,100%);
  padding:1.7rem;
  border:2px solid var(--x-ink);
  border-radius:26px;
  background:var(--x-card);
  box-shadow:12px 12px 0 var(--x-ink);
}

.confirm-heading {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:1rem;
  margin-bottom:1.25rem;
}

.confirm-eyebrow {
  margin:0 0 .3rem;
  color:var(--x-ink);
  font-family:var(--x-mono);
  font-size:.75rem;
  font-weight:800;
  letter-spacing:.08em;
}

.confirm-heading h2 {
  margin:0;
  color:var(--x-ink);
  font-size:clamp(1.8rem,5vw,2.4rem);
  font-weight:800;
}

.confirm-subtitle {
  margin:.25rem 0 0;
  color:var(--x-muted);
}

.confirm-close {
  width:48px;
  height:48px;
  flex-shrink:0;
  border:1.5px solid var(--x-ink);
  border-radius:50%;
  background:white;
  color:var(--x-ink);
  font-size:1.45rem;
  font-weight:800;
}

.confirm-warning {
  padding:1.35rem;
  border:1.5px solid var(--x-ink);
  border-radius:18px;
  background:#ffc9b8;
}

.confirm-warning strong {
  display:block;
  margin-bottom:.45rem;
  color:var(--x-ink);
  font-size:1.15rem;
}

.confirm-warning p {
  margin:0;
  color:var(--x-ink);
  line-height:1.55;
}

.confirm-actions {
  margin-top:1.2rem;
  display:flex;
  gap:.75rem;
  flex-wrap:wrap;
}

.confirm-cancel,
.confirm-delete {
  padding:.65rem 1.1rem;
  border:2px solid var(--x-ink);
  border-radius:999px;
  color:var(--x-ink);
  font-weight:800;
  box-shadow:4px 4px 0 var(--x-ink);
}

.confirm-cancel { background:white; }
.confirm-delete { background:var(--x-orange); }

.confirm-cancel:disabled,
.confirm-delete:disabled,
.confirm-close:disabled {
  opacity:.55;
  cursor:not-allowed;
}

/* TABLET */
@media(max-width:991.98px) {
  .users-container { max-width:760px; }

  .controls {
    grid-template-columns:minmax(0,1fr) 200px;
  }

  .table-wrapper {
    overflow:visible;
    border:none;
    border-radius:0;
    background:transparent;
    box-shadow:none;
  }

  .users-table,
  .users-table tbody {
    display:block;
    width:100%;
  }

  .users-table thead { display:none; }

  .users-table .user-row {
    margin-bottom:1.25rem;
    display:block;
    overflow:hidden;
    border:2px solid var(--x-ink);
    border-radius:20px;
    background:white;
    box-shadow:7px 7px 0 var(--x-ink);
  }

  .users-table .user-row:hover { background:white; }

  .users-table .user-row td {
    padding:.85rem 1rem;
    display:grid;
    grid-template-columns:105px minmax(0,1fr);
    align-items:center;
    gap:1rem;
    border-bottom:1px solid var(--x-paper);
  }

  .users-table .user-row td:last-child { border-bottom:none; }

  .users-table .user-row td::before {
    content:attr(data-label);
    color:var(--x-muted);
    font-size:.72rem;
    font-weight:800;
    letter-spacing:.06em;
    text-transform:uppercase;
  }

  .role-select { width:min(180px,100%); }
  .action-buttons { justify-content:flex-start; }
  .action-btn { min-width:86px; }

  .empty-row {
    display:block !important;
    border:2px solid var(--x-ink) !important;
    border-radius:18px;
    background:white;
    box-shadow:6px 6px 0 var(--x-ink);
  }
}

/* MOBILE */
@media(max-width:767.98px) {
  .users-page { padding:6rem .75rem 2rem; }

  .page-heading {
    padding:1.4rem;
    align-items:flex-start;
    gap:1rem;
  }

  .page-heading h1 { font-size:1.9rem; }

  .page-description {
    max-width:100%;
    font-size:.9rem;
    line-height:1.5;
  }

  .user-count {
    min-width:88px;
    height:42px;
    padding:0 .8rem;
    font-size:.8rem;
  }

  .controls {
    grid-template-columns:minmax(0,1fr) 140px;
    gap:.65rem;
  }

  .search-box,
  .filter-select { min-height:50px; }

  .search-box { padding:0 .85rem; }
  .filter-select { padding:0 .75rem; font-size:.9rem; }
}

@media(max-width:575.98px) {
  .page-heading { flex-direction:column; }

  .user-count {
    align-self:flex-start;
    min-width:auto;
  }

  .users-table .user-row td {
    padding:.8rem .9rem;
    grid-template-columns:82px minmax(0,1fr);
    gap:.65rem;
  }

  .users-table .user-row td::before { font-size:.65rem; }
  .avatar { width:32px; height:32px; }
  .role-select { width:100%; max-width:180px; }
  .action-buttons { width:100%; }
  .action-btn { width:100%; min-width:0; }
  .page-button { width:46px; height:46px; }
}

@media(max-width:420px) {
  .controls { grid-template-columns:1fr; }
  .page-heading h1 { font-size:1.7rem; }
  .page-description { font-size:.85rem; }

  .users-table .user-row td { display:block; }

  .users-table .user-row td::before {
    display:block;
    margin-bottom:.45rem;
  }

  .role-select { max-width:none; }
}
</style>