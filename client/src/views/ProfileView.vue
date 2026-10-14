<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'
import { fetchSavedIds } from '../utils/saved.js'

const router = useRouter()
const user = ref(null)
const savedIds = ref([])
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const editing = ref(false)
const showDeleteModal = ref(false)
const showPasswordModal = ref(false)
const changingPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const name = ref('')
const email = ref('')
const wifiRequired = ref(false)
const socketsRequired = ref(false)
const quietPreferred = ref(false)
const indoorPreferred = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const initials = computed(() => {
  if (!user.value?.name) return ''
  return user.value.name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const memberSince = computed(() => {
  if (!user.value?.createdAt) return ''
  return new Date(user.value.createdAt).toLocaleDateString('en-SG', {
    month: 'short',
    year: 'numeric'
  })
})

async function getProfile() {
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
    return
  }

  try {
    const [profileResponse, ids] = await Promise.all([
      axios.get(`${BASE_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetchSavedIds()
    ])

    user.value = profileResponse.data
    savedIds.value = ids
    setFormValues()
  } catch (error) {
    handleAuthError(error, 'Unable to load profile.')
  } finally {
    loading.value = false
  }
}

function setFormValues() {
  name.value = user.value.name
  email.value = user.value.email
  wifiRequired.value = user.value.preferences?.wifiRequired || false
  socketsRequired.value = user.value.preferences?.socketsRequired || false
  quietPreferred.value = user.value.preferences?.quietPreferred || false
  indoorPreferred.value = user.value.preferences?.indoorPreferred || false
}

function editProfile() {
  successMessage.value = ''
  errorMessage.value = ''
  setFormValues()
  editing.value = true
}

function cancelEdit() {
  setFormValues()
  editing.value = false
  errorMessage.value = ''
}

async function saveProfile() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!name.value.trim()) {
    errorMessage.value = 'Name is required.'
    return
  }

  if (!email.value.trim()) {
    errorMessage.value = 'Email is required.'
    return
  }

  const token = localStorage.getItem('token')

  try {
    saving.value = true

    const response = await axios.put(
      `${BASE_URL}/users/profile`,
      {
        name: name.value.trim(),
        email: email.value.trim(),
        preferences: {
          wifiRequired: wifiRequired.value,
          socketsRequired: socketsRequired.value,
          quietPreferred: quietPreferred.value,
          indoorPreferred: indoorPreferred.value
        }
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )

    user.value = response.data.user
    localStorage.setItem('user', JSON.stringify(response.data.user))
    window.dispatchEvent(new Event('user-login'))
    successMessage.value = 'Profile updated successfully.'
    editing.value = false
  } catch (error) {
    handleAuthError(error, 'Unable to update profile.')
  } finally {
    saving.value = false
  }
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.dispatchEvent(new Event('user-login'))
  router.push('/')
}

function openPasswordModal() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = ''
  showPasswordModal.value = true
}

function closePasswordModal() {
  if (changingPassword.value) return
  showPasswordModal.value = false
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = ''
}

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = 'All password fields are required.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'New passwords do not match.'
    return
  }

  const token = localStorage.getItem('token')

  try {
    changingPassword.value = true

    const response = await axios.put(
      `${BASE_URL}/users/profile/password`,
      {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        confirmPassword: confirmPassword.value
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )

    passwordSuccess.value = response.data.message
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      router.push('/login')
      return
    }

    passwordError.value =
      error.response?.data?.error || 'Unable to change password.'
  } finally {
    changingPassword.value = false
  }
}

function openDeleteModal() {
  errorMessage.value = ''
  showDeleteModal.value = true
}

function closeDeleteModal() {
  if (deleting.value) return
  showDeleteModal.value = false
}

async function deleteAccount() {
  const token = localStorage.getItem('token')

  try {
    deleting.value = true

    await axios.delete(`${BASE_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('user-login'))
    router.push('/')
  } catch (error) {
    showDeleteModal.value = false
    handleAuthError(error, 'Unable to delete account.')
  } finally {
    deleting.value = false
  }
}

function handleAuthError(error, defaultMessage) {
  if (error.response?.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('user-login'))
    router.push('/login')
    return
  }

  errorMessage.value =
    error.response?.data?.error || defaultMessage
}

onMounted(() => {
  getProfile()
})
</script>

<template>
  <main class="profile-page">
    <div class="container profile-container">
      <div class="page-heading">
        <div>
          <p class="page-label">ACCOUNT</p>
          <h1>My Profile</h1>
        </div>
      </div>

      <div v-if="loading" class="profile-loading">
        <div class="spinner-border text-primary"></div>
        <span>Loading profile...</span>
      </div>

      <template v-else>
        <div v-if="errorMessage" class="alert alert-danger">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="alert alert-success">
          {{ successMessage }}
        </div>

        <div v-if="user && !editing" class="profile-card">
          <section class="profile-header">
            <div class="profile-main">
              <div class="profile-avatar">{{ initials }}</div>

              <div class="profile-info">
                <h2>{{ user.name }}</h2>
                <p>{{ user.email }}</p>

                <div class="profile-stats">
                  <span>{{ savedIds.length }} Saved Places</span>
                  <span class="profile-stat-divider"></span>
                  <span v-if="memberSince">
                    Member since {{ memberSince }}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="btn edit-button"
              @click="editProfile"
            >
              Edit Profile
            </button>
          </section>

          <section class="profile-section">
            <div class="section-heading">
              <h3>Study Preferences</h3>
              <p>Used to personalise your study space results.</p>
            </div>

            <div class="preferences-grid">
              <div class="preference-row">
                <div>
                  <strong>Wi-Fi</strong>
                  <span>Reliable internet access</span>
                </div>

                <span
                  class="status"
                  :class="{ active: user.preferences?.wifiRequired }"
                >
                  {{
                    user.preferences?.wifiRequired
                      ? 'Required'
                      : 'Not required'
                  }}
                </span>
              </div>

              <div class="preference-row">
                <div>
                  <strong>Power Sockets</strong>
                  <span>Access to charging points</span>
                </div>

                <span
                  class="status"
                  :class="{ active: user.preferences?.socketsRequired }"
                >
                  {{
                    user.preferences?.socketsRequired
                      ? 'Required'
                      : 'Not required'
                  }}
                </span>
              </div>

              <div class="preference-row">
                <div>
                  <strong>Quiet Environment</strong>
                  <span>Preference for quieter spaces</span>
                </div>

                <span
                  class="status"
                  :class="{ active: user.preferences?.quietPreferred }"
                >
                  {{
                    user.preferences?.quietPreferred
                      ? 'Preferred'
                      : 'No preference'
                  }}
                </span>
              </div>

              <div class="preference-row">
                <div>
                  <strong>Indoor Location</strong>
                  <span>Preference for indoor spaces</span>
                </div>

                <span
                  class="status"
                  :class="{ active: user.preferences?.indoorPreferred }"
                >
                  {{
                    user.preferences?.indoorPreferred
                      ? 'Preferred'
                      : 'No preference'
                  }}
                </span>
              </div>
            </div>
          </section>

          <section class="settings-row">
            <div>
              <h3>Account & Security</h3>
              <p>Update your account password.</p>
            </div>

            <button
              type="button"
              class="btn btn-outline-primary"
              @click="openPasswordModal"
            >
              Change Password
            </button>
          </section>

          <section class="settings-row">
            <div>
              <h3>Log Out</h3>
              <p>Sign out of LockedIN on this device.</p>
            </div>

            <button
              type="button"
              class="btn btn-outline-primary"
              data-test="logout"
              @click="logout"
            >
              Log Out
            </button>
          </section>

          <section class="settings-row danger-row">
            <div>
              <h3>Delete Account</h3>
              <p>Permanently delete your LockedIN account.</p>
            </div>

            <button
              type="button"
              class="btn btn-outline-danger"
              @click="openDeleteModal"
            >
              Delete Account
            </button>
          </section>
        </div>

        <div v-if="user && editing" class="profile-card edit-card">
          <div class="edit-heading">
            <p class="page-label">PROFILE SETTINGS</p>
            <h2>Edit Profile</h2>
          </div>

          <form @submit.prevent="saveProfile">
            <div class="row g-3">
              <div class="col-md-6">
                <label for="name" class="form-label fw-semibold">
                  Name
                </label>

                <input
                  id="name"
                  v-model="name"
                  type="text"
                  class="form-control profile-input"
                  required
                >
              </div>

              <div class="col-md-6">
                <label for="email" class="form-label fw-semibold">
                  Email
                </label>

                <input
                  id="email"
                  v-model="email"
                  type="email"
                  class="form-control profile-input"
                  required
                >
              </div>
            </div>

            <div class="edit-divider"></div>

            <div class="section-heading">
              <h3>Study Preferences</h3>
              <p>Select what matters when finding a study space.</p>
            </div>

            <div class="edit-preferences">
              <label class="edit-preference">
                <div>
                  <strong>Wi-Fi</strong>
                  <span>Require reliable internet access</span>
                </div>

                <div class="form-check form-switch">
                  <input
                    v-model="wifiRequired"
                    class="form-check-input"
                    type="checkbox"
                  >
                </div>
              </label>

              <label class="edit-preference">
                <div>
                  <strong>Power Sockets</strong>
                  <span>Require access to charging points</span>
                </div>

                <div class="form-check form-switch">
                  <input
                    v-model="socketsRequired"
                    class="form-check-input"
                    type="checkbox"
                  >
                </div>
              </label>

              <label class="edit-preference">
                <div>
                  <strong>Quiet Environment</strong>
                  <span>Prefer quieter study spaces</span>
                </div>

                <div class="form-check form-switch">
                  <input
                    v-model="quietPreferred"
                    class="form-check-input"
                    type="checkbox"
                  >
                </div>
              </label>

              <label class="edit-preference">
                <div>
                  <strong>Indoor Location</strong>
                  <span>Prefer indoor study spaces</span>
                </div>

                <div class="form-check form-switch">
                  <input
                    v-model="indoorPreferred"
                    class="form-check-input"
                    type="checkbox"
                  >
                </div>
              </label>
            </div>

            <div class="edit-actions">
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="saving"
                @click="cancelEdit"
              >
                Cancel
              </button>

              <button
                type="submit"
                class="btn save-button"
                :disabled="saving"
              >
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>

        <div
          v-if="showPasswordModal"
          class="profile-modal-backdrop"
          @click.self="closePasswordModal"
        >
          <div class="profile-modal-card">
            <p class="page-label">ACCOUNT SECURITY</p>
            <h2>Change Password</h2>

            <p class="modal-description">
              Enter your current password and choose a new password.
            </p>

            <div
              v-if="passwordError"
              class="alert alert-danger"
            >
              {{ passwordError }}
            </div>

            <div
              v-if="passwordSuccess"
              class="alert alert-success"
            >
              {{ passwordSuccess }}
            </div>

            <form @submit.prevent="changePassword">
              <div class="mb-3">
                <label
                  for="currentPassword"
                  class="form-label fw-semibold"
                >
                  Current Password
                </label>

                <input
                  id="currentPassword"
                  v-model="currentPassword"
                  type="password"
                  class="form-control profile-input"
                  autocomplete="current-password"
                  required
                >
              </div>

              <div class="mb-3">
                <label
                  for="newPassword"
                  class="form-label fw-semibold"
                >
                  New Password
                </label>

                <input
                  id="newPassword"
                  v-model="newPassword"
                  type="password"
                  class="form-control profile-input"
                  autocomplete="new-password"
                  required
                >
              </div>

              <div class="mb-3">
                <label
                  for="confirmPassword"
                  class="form-label fw-semibold"
                >
                  Confirm New Password
                </label>

                <input
                  id="confirmPassword"
                  v-model="confirmPassword"
                  type="password"
                  class="form-control profile-input"
                  autocomplete="new-password"
                  required
                >
              </div>

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :disabled="changingPassword"
                  @click="closePasswordModal"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  class="btn save-button"
                  :disabled="changingPassword"
                >
                  {{
                    changingPassword
                      ? 'Changing...'
                      : 'Change Password'
                  }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div
          v-if="showDeleteModal"
          class="profile-modal-backdrop"
          @click.self="closeDeleteModal"
        >
          <div class="profile-modal-card">
            <div class="danger-icon">!</div>

            <h2>Delete Account?</h2>

            <p class="modal-description">
              Your LockedIN account will be permanently deleted.
              This action cannot be undone.
            </p>

            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="deleting"
                @click="closeDeleteModal"
              >
                Cancel
              </button>

              <button
                type="button"
                class="btn btn-danger"
                :disabled="deleting"
                @click="deleteAccount"
              >
                {{ deleting ? 'Deleting...' : 'Delete Account' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.profile-page {
  min-height: calc(100vh - 120px);
  padding: 2rem 1rem 3rem;
  background: var(--x-card);
}

.profile-container {
  max-width: 1000px;
}

.page-heading {
  margin-bottom: 1.25rem;
}

.page-label {
  margin: 0 0 .25rem;
  color: var(--x-ink);
  font-size: .73rem;
  font-weight: 800;
  letter-spacing: .14em;
}

.page-heading h1 {
  margin: 0;
  color: var(--x-ink);
  font-size: 2rem;
  font-weight: 800;
}

.profile-loading {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .8rem;
}

.profile-card {
  overflow: hidden;
  border: 1px solid var(--x-ink);
  border-radius: 18px;
  background: white;
  box-shadow: var(--x-pop);
}

.profile-header {
  padding: 1.5rem 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid var(--x-ink);
  background: var(--x-card);
}

.profile-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--x-paper);
  color: var(--x-ink);
  font-size: 1.2rem;
  font-weight: 800;
}

.profile-main h2 {
  margin: 0;
  color: var(--x-ink);
  font-size: 1.25rem;
  font-weight: 800;
}

.profile-main p {
  margin: .2rem 0 0;
  color: var(--x-muted);
  font-size: .9rem;
}

.profile-stats {
  margin-top: .6rem;
  display: flex;
  align-items: center;
  gap: .6rem;
  color: var(--x-muted);
  font-family: var(--x-mono);
  font-size: .75rem;
}

.profile-stat-divider {
  width: 1px;
  height: 13px;
  background: var(--x-ink);
  opacity: .3;
}

.edit-button,
.save-button {
  border: 0;
  color: white;
  background: var(--x-orange);
}

.edit-button {
  padding: .65rem 1.2rem;
  border-radius: 10px;
  font-weight: 700;
}

.edit-button:hover,
.save-button:hover {
  color: white;
  background: var(--x-orange);
}

.profile-section {
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid var(--x-ink);
}

.section-heading {
  margin-bottom: 1rem;
}

.section-heading h3,
.settings-row h3 {
  margin: 0;
  color: var(--x-ink);
  font-size: 1rem;
  font-weight: 800;
}

.section-heading p,
.settings-row p {
  margin: .25rem 0 0;
  color: var(--x-muted);
  font-size: .85rem;
}

.preferences-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .75rem;
}

.preference-row {
  min-height: 74px;
  padding: .9rem 1rem;
  border: 1px solid var(--x-ink);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--x-card);
}

.preference-row > div {
  min-width: 0;
}

.preference-row strong,
.edit-preference strong {
  display: block;
  color: var(--x-ink);
  font-size: .9rem;
}

.preference-row div span,
.edit-preference div span {
  display: block;
  margin-top: .15rem;
  color: var(--x-muted);
  font-size: .78rem;
}

.status {
  flex-shrink: 0;
  padding: .3rem .65rem;
  border-radius: 999px;
  background: var(--x-paper);
  color: var(--x-muted);
  font-size: .73rem;
  font-weight: 700;
}

.status.active {
  background: var(--x-lime);
  color: var(--ss-success);
}

.settings-row {
  padding: 1.15rem 1.75rem;
  border-bottom: 1px solid var(--x-ink);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.danger-row {
  border-bottom: 0;
  background: var(--ss-danger-soft);
}

.danger-row h3 {
  color: var(--ss-danger);
}

.edit-card {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.75rem;
}

.edit-heading {
  margin-bottom: 1.5rem;
}

.edit-heading h2 {
  margin: 0;
  color: var(--x-ink);
  font-size: 1.5rem;
  font-weight: 800;
}

.profile-input {
  min-height: 44px;
  border-radius: 9px;
  border-color: var(--x-ink);
}

.profile-input:focus {
  border-color: var(--x-ink);
  box-shadow: 0 0 0 3px var(--x-lime);
}

.edit-divider {
  height: 1px;
  margin: 1.5rem 0;
  background: var(--x-paper);
}

.edit-preferences {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .75rem;
}

.edit-preference {
  min-height: 72px;
  padding: .9rem 1rem;
  border: 1px solid var(--x-ink);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--x-card);
  cursor: pointer;
}

.form-switch {
  margin: 0;
  padding-left: 2.8rem;
}

.form-switch .form-check-input {
  width: 2.5rem;
  height: 1.3rem;
  cursor: pointer;
}

.edit-actions,
.modal-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: .75rem;
}

.save-button {
  padding-left: 1.2rem;
  padding-right: 1.2rem;
}

.profile-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1050;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(18, 24, 42, .5);
  backdrop-filter: blur(3px);
}

.profile-modal-card {
  width: 100%;
  max-width: 450px;
  padding: 1.75rem;
  border-radius: 18px;
  background: white;
  box-shadow: var(--x-pop);
}

.profile-modal-card h2 {
  margin: 0 0 .4rem;
  color: var(--x-ink);
  font-size: 1.35rem;
  font-weight: 800;
}

.modal-description {
  margin-bottom: 1.25rem;
  color: var(--x-muted);
  font-size: .9rem;
}

.danger-icon {
  width: 42px;
  height: 42px;
  margin-bottom: .9rem;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ss-danger-soft);
  color: var(--ss-danger);
  font-weight: 900;
}

@media (max-width: 767px) {
  .profile-page {
    padding: 1.5rem .75rem 2.5rem;
  }

  .page-heading h1 {
    font-size: 1.75rem;
  }

  .profile-header {
    align-items: flex-start;
  }

  .preferences-grid,
  .edit-preferences {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 575px) {
  .profile-header {
    flex-direction: column;
    padding: 1.2rem;
  }

  .edit-button {
    width: 100%;
  }

  .profile-section,
  .settings-row,
  .edit-card {
    padding: 1.2rem;
  }

  .settings-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-row button {
    width: 100%;
  }

  .profile-stats {
    flex-wrap: wrap;
    gap: .45rem;
    font-size: .7rem;
  }

  .preference-row {
    align-items: flex-start;
  }

  .edit-actions,
  .modal-actions {
    flex-direction: column-reverse;
  }

  .edit-actions button,
  .modal-actions button {
    width: 100%;
  }

  .profile-modal-card {
    padding: 1.4rem;
  }
}
</style>