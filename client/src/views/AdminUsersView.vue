<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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
const savingEdit = ref(false)

const search = ref('')
const roleFilter = ref('all')
const currentPage = ref(1)
const perPage = 10

const editingUser = ref(null)
const editName = ref('')
const editEmail = ref('')

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

    successMessage.value =
      `${user.name}'s role was updated to ${user.role}.`
  } catch (error) {
    handleError(error, 'Unable to update user role.')
  } finally {
    updatingId.value = null
  }
}

function openEdit(user) {
  if (isSelf(user)) return

  clearMessages()

  editingUser.value = user
  editName.value = user.name
  editEmail.value = user.email
}

function closeEdit() {
  if (savingEdit.value) return

  editingUser.value = null
  editName.value = ''
  editEmail.value = ''
}

async function saveEdit() {
  if (!editingUser.value) return

  clearMessages()

  const name = editName.value.trim()
  const email = editEmail.value.trim().toLowerCase()

  if (!name || !email) {
    errorMessage.value = 'Name and email are required.'
    return
  }

  try {
    savingEdit.value = true

    const response = await axios.put(
      `${BASE_URL}/users/admin/${editingUser.value._id}`,
      { name, email },
      authConfig()
    )

    const index = users.value.findIndex(
      user => user._id === editingUser.value._id
    )

    if (index !== -1) {
      users.value[index] = {
        ...users.value[index],
        ...response.data.user
      }
    }

    successMessage.value =
      `${response.data.user.name}'s account was updated successfully.`

    editingUser.value = null
    editName.value = ''
    editEmail.value = ''
  } catch (error) {
    handleError(error, 'Unable to update user.')
  } finally {
    savingEdit.value = false
  }
}

async function deleteUser(user) {
  if (isSelf(user)) return

  const confirmed = window.confirm(
    `Delete ${user.name}'s account?\n\n` +
    `They will no longer be able to log in. ` +
    `This cannot be undone.`
  )

  if (!confirmed) return

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

    successMessage.value =
      response.data.message ||
      `${user.name}'s account was deleted successfully.`
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
</script>

<template>
  <main class="users-page">
    <div class="container users-container">

      <!-- HEADER -->
      <div class="page-heading">
        <div>
          <p class="page-label">ADMIN</p>
          <h1>Users</h1>
        </div>

        <span v-if="!loading" class="user-count">
          {{ users.length }} users
        </span>
      </div>

      <!-- MESSAGES -->
      <div v-if="successMessage" class="alert alert-success">
        {{ successMessage }}
      </div>

      <div v-if="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <!-- LOADING -->
      <div v-if="loading" class="loading-state">
        <div class="spinner-border text-primary"></div>
        <span>Loading users...</span>
      </div>

      <template v-else>

        <!-- ADMIN NOTE -->
        <div class="admin-note">
          <strong>Account management</strong>
          <span>
            Edit or remove other accounts.
            Your own admin account is protected here;
            use My Profile for your own details.
          </span>
        </div>

        <!-- SEARCH + FILTER -->
        <div class="controls">
          <div class="search-box">
            <span class="search-icon">⌕</span>

            <input
              v-model="search"
              type="text"
              placeholder="Search by name or email..."
            >
          </div>

          <select
            v-model="roleFilter"
            class="filter-select"
          >
            <option value="all">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        <!-- USERS -->
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

              <tr
                v-for="user in paginatedUsers"
                :key="user._id"
                class="user-row"
              >

                <!-- NAME -->
                <td
                  class="user-name-cell"
                  data-label="Name"
                >
                  <div class="user-name-wrap">
                    <span class="avatar">
                      {{ user.name.charAt(0).toUpperCase() }}
                    </span>

                    <div class="name-line">
                      <span>{{ user.name }}</span>

                      <span
                        v-if="isSelf(user)"
                        class="you-badge"
                      >
                        You
                      </span>
                    </div>
                  </div>
                </td>

                <!-- EMAIL -->
                <td
                  class="email-cell"
                  data-label="Email"
                >
                  {{ user.email }}
                </td>

                <!-- JOINED -->
                <td data-label="Joined">
                  {{ formatDate(user.createdAt) }}
                </td>

                <!-- ROLE -->
                <td data-label="Role">
                  <select
                    class="role-select"
                    :class="user.role"
                    :value="user.role"
                    :disabled="updatingId === user._id || isSelf(user)"
                    @change="updateRole(user, $event.target.value)"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>

                <!-- ACTIONS -->
                <td data-label="Actions">
                  <div
                    v-if="!isSelf(user)"
                    class="action-buttons"
                  >
                    <button
                      class="action-btn edit-btn"
                      type="button"
                      :disabled="deletingId === user._id"
                      @click="openEdit(user)"
                    >
                      Edit
                    </button>

                    <button
                      class="action-btn delete-btn"
                      type="button"
                      :disabled="deletingId === user._id"
                      @click="deleteUser(user)"
                    >
                      {{
                        deletingId === user._id
                          ? 'Deleting...'
                          : 'Delete'
                      }}
                    </button>
                  </div>

                  <span
                    v-else
                    class="protected-text"
                  >
                    Protected
                  </span>
                </td>

              </tr>

              <tr v-if="filteredUsers.length === 0">
                <td
                  colspan="5"
                  class="empty-row"
                >
                  No users found.
                </td>
              </tr>

            </tbody>
          </table>
        </div>

        <!-- PAGINATION -->
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

    <!-- EDIT MODAL -->
    <div
      v-if="editingUser"
      class="edit-overlay"
      @click.self="closeEdit"
    >
      <div class="edit-card">

        <div class="edit-heading">
          <div>
            <p class="page-label mb-1">
              EDIT USER
            </p>

            <h2>
              {{ editingUser.name }}
            </h2>
          </div>

          <button
            class="close-btn"
            type="button"
            :disabled="savingEdit"
            aria-label="Close"
            @click="closeEdit"
          >
            ×
          </button>
        </div>

        <label
          class="edit-label"
          for="adminEditName"
        >
          Name
        </label>

        <input
          id="adminEditName"
          v-model="editName"
          class="edit-input"
          type="text"
          maxlength="60"
        >

        <label
          class="edit-label"
          for="adminEditEmail"
        >
          Email
        </label>

        <input
          id="adminEditEmail"
          v-model="editEmail"
          class="edit-input"
          type="email"
        >

        <p class="edit-help">
          Role is managed separately from the Users page.
        </p>

        <div class="edit-actions">
          <button
            class="btn btn-outline-primary"
            type="button"
            :disabled="savingEdit"
            @click="closeEdit"
          >
            Cancel
          </button>

          <button
            class="btn btn-primary"
            type="button"
            :disabled="savingEdit"
            @click="saveEdit"
          >
            {{ savingEdit ? 'Saving...' : 'Save changes' }}
          </button>
        </div>

      </div>
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
  max-width: 1180px;
}

/* HEADER */

.page-heading {
  margin-bottom: 1.5rem;
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

.page-heading h1,
.edit-heading h2 {
  margin: 0;
  color: var(--x-ink);
  font-weight: 800;
}

.page-heading h1 {
  font-size: 2.2rem;
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

/* NOTE */

.admin-note {
  margin-bottom: 1.5rem;
  padding: .9rem 1.1rem;
  display: flex;
  align-items: center;
  gap: .7rem;
  flex-wrap: wrap;
  border: 1px solid var(--x-ink);
  border-radius: 14px;
  background: var(--x-paper-2);
  color: var(--x-ink);
}

.admin-note span {
  color: var(--x-muted);
  font-size: .88rem;
}

/* CONTROLS */

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
  min-width: 0;
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

/* LOADING */

.loading-state {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

/* DESKTOP TABLE */

.table-wrapper {
  border: 2px solid var(--x-ink);
  border-radius: 22px;
  background: white;
  box-shadow: 9px 9px 0 var(--x-ink);
  overflow: hidden;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 1rem 1.1rem;
  text-align: left;
  vertical-align: middle;
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

/* USER */

.user-name-wrap {
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

.name-line {
  display: flex;
  align-items: center;
  gap: .45rem;
  flex-wrap: wrap;
}

.you-badge {
  padding: .16rem .45rem;
  border: 1px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-lilac);
  font-size: .64rem;
  font-weight: 800;
  text-transform: uppercase;
}

.email-cell {
  overflow-wrap: anywhere;
}

/* ROLE */

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

.role-select:disabled {
  opacity: .72;
  cursor: not-allowed;
}

/* ACTIONS */

.action-buttons {
  display: flex;
  align-items: center;
  gap: .55rem;
  flex-wrap: wrap;
}

.action-btn {
  padding: .45rem .8rem;
  border: 1px solid var(--x-ink);
  border-radius: 999px;
  color: var(--x-ink);
  font-size: .78rem;
  font-weight: 800;
  box-shadow: 3px 3px 0 var(--x-ink);
  transition: .15s ease;
}

.action-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--x-ink);
}

.action-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.edit-btn {
  background: var(--x-lilac);
}

.delete-btn {
  background: #ffc9b8;
}

.protected-text {
  color: var(--x-muted);
  font-size: .78rem;
  font-weight: 700;
}

.empty-row {
  padding: 3rem !important;
  text-align: center !important;
  color: var(--x-muted) !important;
}

/* PAGINATION */

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

/* EDIT MODAL */

.edit-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  padding: 1rem;
  display: grid;
  place-items: center;
  background: rgba(24, 22, 18, .45);
  backdrop-filter: blur(4px);
}

.edit-card {
  width: min(520px, 100%);
  padding: 1.5rem;
  border: 2px solid var(--x-ink);
  border-radius: 22px;
  background: var(--x-card);
  box-shadow: 9px 9px 0 var(--x-ink);
}

.edit-heading {
  margin-bottom: 1.25rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.close-btn {
  width: 38px;
  height: 38px;
  border: 1px solid var(--x-ink);
  border-radius: 50%;
  background: white;
  color: var(--x-ink);
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
}

.edit-label {
  margin: .75rem 0 .35rem;
  display: block;
  color: var(--x-ink);
  font-size: .83rem;
  font-weight: 800;
}

.edit-input {
  width: 100%;
  padding: .75rem .9rem;
  border: 2px solid var(--x-ink);
  border-radius: 12px;
  background: white;
  color: var(--x-ink);
  outline: none;
}

.edit-input:focus {
  box-shadow: 0 0 0 3px var(--x-lilac);
}

.edit-help {
  margin: .75rem 0 0;
  color: var(--x-muted);
  font-size: .78rem;
}

.edit-actions {
  margin-top: 1.4rem;
  display: flex;
  justify-content: flex-end;
  gap: .75rem;
}

/* =========================================================
   TABLET / SMALL LAPTOP
   Turn table rows into cards so Actions are always visible
   ========================================================= */

@media (max-width: 991.98px) {

  .users-container {
    max-width: 760px;
  }

  .controls {
    grid-template-columns: minmax(0, 1fr) 200px;
  }

  .table-wrapper {
    overflow: visible;
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .users-table,
  .users-table tbody {
    display: block;
    width: 100%;
  }

  .users-table thead {
    display: none;
  }

  .users-table .user-row {
    margin-bottom: 1.25rem;
    display: block;
    overflow: hidden;
    border: 2px solid var(--x-ink);
    border-radius: 20px;
    background: white;
    box-shadow: 7px 7px 0 var(--x-ink);
  }

  .users-table .user-row:hover {
    background: white;
  }

  .users-table .user-row td {
    padding: .85rem 1rem;
    display: grid;
    grid-template-columns: 105px minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid var(--x-paper);
  }

  .users-table .user-row td:last-child {
    border-bottom: none;
  }

  .users-table .user-row td::before {
    content: attr(data-label);
    color: var(--x-muted);
    font-size: .72rem;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  .role-select {
    width: min(180px, 100%);
  }

  .action-buttons {
    justify-content: flex-start;
  }

  .action-btn {
    min-width: 86px;
  }

  .empty-row {
    display: block !important;
    border: 2px solid var(--x-ink) !important;
    border-radius: 18px;
    background: white;
    box-shadow: 6px 6px 0 var(--x-ink);
  }
}

/* =========================================================
   MOBILE
   ========================================================= */

@media (max-width: 575.98px) {

  .users-page {
    padding: 6rem .65rem 2rem;
  }

  .page-heading {
    padding: 1.2rem;
    align-items: flex-start;
  }

  .page-heading h1 {
    font-size: 1.8rem;
  }

  .admin-note {
    align-items: flex-start;
    flex-direction: column;
  }

  .controls {
    grid-template-columns: 1fr;
  }

  .search-box,
  .filter-select {
    min-height: 50px;
  }

  .users-table .user-row td {
    padding: .8rem .9rem;
    grid-template-columns: 82px minmax(0, 1fr);
    gap: .65rem;
  }

  .users-table .user-row td::before {
    font-size: .65rem;
  }

  .avatar {
    width: 32px;
    height: 32px;
  }

  .role-select {
    width: 100%;
    max-width: 180px;
  }

  .action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
  }

  .action-btn {
    width: 100%;
    min-width: 0;
  }

  .page-button {
    width: 46px;
    height: 46px;
  }

  .edit-actions {
    flex-direction: column-reverse;
  }

  .edit-actions .btn {
    width: 100%;
  }
}

/* EXTRA SMALL PHONE */

@media (max-width: 390px) {

  .page-heading {
    flex-direction: column;
  }

  .users-table .user-row td {
    display: block;
  }

  .users-table .user-row td::before {
    display: block;
    margin-bottom: .45rem;
  }

  .action-buttons {
    grid-template-columns: 1fr;
  }

  .role-select {
    max-width: none;
  }
}
</style>