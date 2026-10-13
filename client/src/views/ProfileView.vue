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
        email: email.value.trim()
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
  errorMessage.value = error.response?.data?.error || defaultMessage
}

onMounted(getProfile)
</script>

<template>
  <main class="profile-page">
    <div class="profile-container">
      <h1 class="page-title">My Profile</h1>

      <div v-if="loading" class="loading-state">
        <div class="spinner-border text-primary"></div>
      </div>

      <template v-else>
        <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
        <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>

        <div v-if="user && !editing" class="profile-card">
          <section class="profile-top">
            <div class="profile-person">
              <div class="avatar">{{ initials }}</div>

              <div class="profile-info">
                <h2>{{ user.name }}</h2>
                <p class="email">{{ user.email }}</p>

                <div class="meta">
                  <span>{{ savedIds.length }} Saved Places</span>
                  <span class="divider"></span>
                  <span>Member since {{ memberSince }}</span>
                </div>
              </div>
            </div>

            <button class="primary-btn" @click="editProfile">
              Edit Profile
            </button>
          </section>

          <section class="action-row">
            <h3>Account & Security</h3>

            <button
              class="outline-btn"
              @click="openPasswordModal"
            >
              Change Password
            </button>
          </section>

          <section class="action-row delete-row">
            <h3>Delete Account</h3>

            <button
              class="delete-btn"
              @click="openDeleteModal"
            >
              Delete Account
            </button>
          </section>
        </div>

        <div v-if="user && editing" class="edit-card">
          <div class="edit-header">
            <h2>Edit Profile</h2>
          </div>

          <form @submit.prevent="saveProfile">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label" for="name">Name</label>
                <input
                  id="name"
                  v-model="name"
                  type="text"
                  class="form-control profile-input"
                  required
                >
              </div>

              <div class="col-md-6">
                <label class="form-label" for="email">Email</label>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  class="form-control profile-input"
                  required
                >
              </div>
            </div>

            <div class="form-actions">
              <button
                type="button"
                class="cancel-btn"
                :disabled="saving"
                @click="cancelEdit"
              >
                Cancel
              </button>

              <button
                type="submit"
                class="primary-btn"
                :disabled="saving"
              >
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>

        <div
          v-if="showPasswordModal"
          class="modal-overlay"
          @click.self="closePasswordModal"
        >
          <div class="modal-box">
            <h2>Change Password</h2>

            <div v-if="passwordError" class="alert alert-danger">
              {{ passwordError }}
            </div>

            <div v-if="passwordSuccess" class="alert alert-success">
              {{ passwordSuccess }}
            </div>

            <form @submit.prevent="changePassword">
              <div class="mb-3">
                <label class="form-label" for="currentPassword">
                  Current Password
                </label>

                <input
                  id="currentPassword"
                  v-model="currentPassword"
                  type="password"
                  class="form-control profile-input"
                  required
                >
              </div>

              <div class="mb-3">
                <label class="form-label" for="newPassword">
                  New Password
                </label>

                <input
                  id="newPassword"
                  v-model="newPassword"
                  type="password"
                  class="form-control profile-input"
                  required
                >
              </div>

              <div class="mb-3">
                <label class="form-label" for="confirmPassword">
                  Confirm New Password
                </label>

                <input
                  id="confirmPassword"
                  v-model="confirmPassword"
                  type="password"
                  class="form-control profile-input"
                  required
                >
              </div>

              <div class="form-actions">
                <button
                  type="button"
                  class="cancel-btn"
                  :disabled="changingPassword"
                  @click="closePasswordModal"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  class="primary-btn"
                  :disabled="changingPassword"
                >
                  {{ changingPassword ? 'Changing...' : 'Change Password' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div
          v-if="showDeleteModal"
          class="modal-overlay"
          @click.self="closeDeleteModal"
        >
          <div class="modal-box">
            <h2>Delete Account?</h2>
            <p class="modal-text">This action cannot be undone.</p>

            <div class="form-actions">
              <button
                type="button"
                class="cancel-btn"
                :disabled="deleting"
                @click="closeDeleteModal"
              >
                Cancel
              </button>

              <button
                type="button"
                class="danger-filled-btn"
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
  min-height: calc(100vh - 90px);
  padding: 3.5rem 1.5rem;
  background: #f7f8fb;
}

.profile-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.page-title {
  margin: 0 0 2rem;
  color: #151827;
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -.04em;
}

.loading-state {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-card,
.edit-card {
  overflow: hidden;
  border: 1px solid #e4e7ee;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 18px 50px rgba(24, 35, 61, .07);
}

.profile-top {
  min-height: 180px;
  padding: 2.2rem 2.4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  border-bottom: 1px solid #edf0f4;
  background:
    radial-gradient(circle at 85% 20%, rgba(110, 115, 210, .09), transparent 30%),
    linear-gradient(135deg, #fbfcff 0%, #f8f8ff 100%);
}

.profile-person {
  display: flex;
  align-items: center;
  gap: 1.4rem;
}

.avatar {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #dfe7ff, #dfdcf7);
  color: #415590;
  font-size: 2rem;
  font-weight: 800;
  box-shadow: 0 0 0 7px rgba(255, 255, 255, .65);
}

.profile-info h2 {
  margin: 0;
  color: #181c2b;
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -.03em;
}

.email {
  margin: .3rem 0 0;
  color: #777f90;
  font-size: 1rem;
}

.meta {
  margin-top: .8rem;
  display: flex;
  align-items: center;
  gap: .75rem;
  color: #596274;
  font-size: .88rem;
  font-weight: 600;
}

.divider {
  width: 1px;
  height: 14px;
  background: #cbd0da;
}

.action-row {
  min-height: 92px;
  padding: 1.25rem 2.4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid #edf0f4;
}

.action-row:last-child {
  border-bottom: 0;
}

.action-row h3 {
  margin: 0;
  color: #262b39;
  font-size: 1rem;
  font-weight: 700;
}

.delete-row h3 {
  color: #b34951;
}

.primary-btn,
.outline-btn,
.delete-btn,
.cancel-btn,
.danger-filled-btn {
  min-height: 44px;
  padding: 0 1.2rem;
  border-radius: 10px;
  font-size: .92rem;
  font-weight: 700;
  transition: all .2s ease;
}

.primary-btn {
  min-width: 130px;
  border: 0;
  color: #fff;
  background: linear-gradient(135deg, #557bc4, #6665b9);
  box-shadow: 0 5px 14px rgba(86, 105, 186, .22);
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(86, 105, 186, .28);
}

.outline-btn {
  min-width: 150px;
  border: 1px solid #b6bfd0;
  color: #426db4;
  background: #fff;
}

.outline-btn:hover {
  border-color: #6787c1;
  background: #f7f9fd;
}

.delete-btn {
  min-width: 145px;
  border: 1px solid #df8f96;
  color: #c34851;
  background: #fff;
}

.delete-btn:hover {
  border-color: #c34851;
  background: #fff7f7;
}

.edit-card {
  padding: 2rem;
}

.edit-header h2 {
  margin: 0 0 1.5rem;
  color: #1b1f2e;
  font-size: 1.45rem;
  font-weight: 800;
}

.form-label {
  color: #343a49;
  font-size: .88rem;
  font-weight: 700;
}

.profile-input {
  min-height: 48px;
  border: 1px solid #dce1e9;
  border-radius: 10px;
  background: #fafbfc;
}

.profile-input:focus {
  border-color: #7189c8;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(87, 111, 182, .1);
}

.form-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: .7rem;
}

.cancel-btn {
  border: 1px solid #d1d6df;
  color: #555e6d;
  background: #fff;
}

.cancel-btn:hover {
  background: #f7f8fa;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050;
  padding: 1rem;
  display: grid;
  place-items: center;
  background: rgba(20, 25, 39, .42);
  backdrop-filter: blur(5px);
}

.modal-box {
  width: 100%;
  max-width: 430px;
  padding: 1.8rem;
  border: 1px solid #e7e9ee;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(14, 20, 36, .2);
}

.modal-box h2 {
  margin: 0 0 1.2rem;
  color: #1c2030;
  font-size: 1.35rem;
  font-weight: 800;
}

.modal-text {
  margin: 0;
  color: #747b89;
}

.danger-filled-btn {
  border: 0;
  color: #fff;
  background: #c74952;
}

.danger-filled-btn:hover {
  background: #b43d46;
}

@media (max-width: 767px) {
  .profile-page {
    padding: 2rem 1rem;
  }

  .page-title {
    font-size: 2.1rem;
  }

  .profile-top {
    padding: 1.8rem;
    align-items: flex-start;
    flex-direction: column;
  }

  .primary-btn {
    width: 100%;
  }

  .action-row {
    padding: 1.2rem 1.8rem;
  }
}

@media (max-width: 575px) {
  .profile-page {
    padding: 1.5rem .8rem;
  }

  .page-title {
    margin-bottom: 1.4rem;
    font-size: 1.9rem;
  }

  .profile-card,
  .edit-card {
    border-radius: 17px;
  }

  .profile-top {
    padding: 1.5rem;
  }

  .profile-person {
    gap: 1rem;
    align-items: flex-start;
  }

  .avatar {
    width: 68px;
    height: 68px;
    font-size: 1.5rem;
  }

  .profile-info h2 {
    font-size: 1.5rem;
  }

  .email {
    font-size: .9rem;
  }

  .meta {
    gap: .5rem;
    flex-wrap: wrap;
    font-size: .76rem;
  }

  .action-row {
    min-height: auto;
    padding: 1.25rem 1.5rem;
    flex-direction: column;
    align-items: stretch;
  }

  .action-row h3 {
    font-size: .95rem;
  }

  .outline-btn,
  .delete-btn {
    width: 100%;
  }

  .edit-card {
    padding: 1.4rem;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions button {
    width: 100%;
  }

  .modal-box {
    padding: 1.4rem;
  }
}
</style>