<!-- Stub - owner: Khin Bhone Pyae (authentication and profile management).
The route and layout exist so the app's shape is complete; the form is not wired yet.
 -->

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const router = useRouter()

const user = ref(null)
const loading = ref(true)
const saving = ref(false)
const editing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const name = ref('')
const wifiRequired = ref(false)
const socketsRequired = ref(false)
const quietPreferred = ref(false)
const indoorPreferred = ref(false)

async function getProfile() {
  const token = localStorage.getItem('token')

  if (!token) {
    router.push('/login')
    return
  }

  try {
    const response = await axios.get(`${BASE_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    user.value = response.data
    setFormValues()
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      router.push('/login')
    } else {
      errorMessage.value = 'Unable to load profile.'
    }
  } finally {
    loading.value = false
  }
}

function setFormValues() {
  name.value = user.value.name
  wifiRequired.value = user.value.preferences.wifiRequired
  socketsRequired.value = user.value.preferences.socketsRequired
  quietPreferred.value = user.value.preferences.quietPreferred
  indoorPreferred.value = user.value.preferences.indoorPreferred
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

  const token = localStorage.getItem('token')

  try {
    saving.value = true

    const response = await axios.put(`${BASE_URL}/users/profile`, {
      name: name.value,
      preferences: {
        wifiRequired: wifiRequired.value,
        socketsRequired: socketsRequired.value,
        quietPreferred: quietPreferred.value,
        indoorPreferred: indoorPreferred.value
      }
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    user.value = response.data.user

    localStorage.setItem('user', JSON.stringify(response.data.user))
    window.dispatchEvent(new Event('user-login'))

    successMessage.value = 'Profile updated successfully.'
    editing.value = false
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      router.push('/login')
    } else if (error.response?.data?.error) {
      errorMessage.value = error.response.data.error
    } else {
      errorMessage.value = 'Unable to update profile.'
    }
  } finally {
    saving.value = false
  }
}

async function deleteAccount() {
  const confirmed = confirm(
    'Are you sure you want to delete your account? This action cannot be undone.'
  )

  if (!confirmed) {
    return
  }

  const token = localStorage.getItem('token')

  try {
    await axios.delete(`${BASE_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    localStorage.removeItem('token')
    localStorage.removeItem('user')

    window.dispatchEvent(new Event('user-login'))

    router.push('/')
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      router.push('/login')
    } else if (error.response?.data?.error) {
      errorMessage.value = error.response.data.error
    } else {
      errorMessage.value = 'Unable to delete account.'
    }
  }
}

onMounted(() => {
  getProfile()
})
</script>

<template>
  <main class="container ss-section">
    <div class="ss-card p-4 p-md-5 mx-auto" style="max-width: 650px">
      <h1 class="h3 mb-4">My Profile</h1>

      <div v-if="loading">
        <p class="ss-muted">Loading profile...</p>
      </div>

      <template v-else>
        <div v-if="errorMessage" class="alert alert-danger">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="alert alert-success">
          {{ successMessage }}
        </div>

        <div v-if="user && !editing">
          <div class="mb-4">
            <label class="form-label fw-semibold">Name</label>
            <p>{{ user.name }}</p>
          </div>

          <div class="mb-4">
            <label class="form-label fw-semibold">Email</label>
            <p>{{ user.email }}</p>
          </div>

          <hr>

          <h2 class="h5 mb-3">Study Preferences</h2>

          <div class="mb-2">
            Wi-Fi required:
            <strong>{{ user.preferences.wifiRequired ? 'Yes' : 'No' }}</strong>
          </div>

          <div class="mb-2">
            Power sockets required:
            <strong>{{ user.preferences.socketsRequired ? 'Yes' : 'No' }}</strong>
          </div>

          <div class="mb-2">
            Quiet environment preferred:
            <strong>{{ user.preferences.quietPreferred ? 'Yes' : 'No' }}</strong>
          </div>

          <div class="mb-4">
            Indoor location preferred:
            <strong>{{ user.preferences.indoorPreferred ? 'Yes' : 'No' }}</strong>
          </div>

          <button class="btn btn-primary" @click="editProfile">
            Edit Profile
          </button>

          <button class="btn btn-outline-danger ms-2" @click="deleteAccount">
            Delete Account
          </button>
        </div>

        <form v-if="user && editing" @submit.prevent="saveProfile">
          <div class="mb-4">
            <label for="name" class="form-label fw-semibold">Name</label>
            <input id="name" v-model="name" type="text" class="form-control">
          </div>

          <div class="mb-4">
            <label class="form-label fw-semibold">Email</label>
            <input :value="user.email" type="email" class="form-control" disabled>
            <div class="form-text">Email cannot be changed here.</div>
          </div>

          <hr>

          <h2 class="h5 mb-3">Study Preferences</h2>

          <div class="form-check mb-3">
            <input id="wifi" v-model="wifiRequired" class="form-check-input" type="checkbox">
            <label for="wifi" class="form-check-label">
              Wi-Fi required
            </label>
          </div>

          <div class="form-check mb-3">
            <input id="sockets" v-model="socketsRequired" class="form-check-input" type="checkbox">
            <label for="sockets" class="form-check-label">
              Power sockets required
            </label>
          </div>

          <div class="form-check mb-3">
            <input id="quiet" v-model="quietPreferred" class="form-check-input" type="checkbox">
            <label for="quiet" class="form-check-label">
              Quiet environment preferred
            </label>
          </div>

          <div class="form-check mb-4">
            <input id="indoor" v-model="indoorPreferred" class="form-check-input" type="checkbox">
            <label for="indoor" class="form-check-label">
              Indoor location preferred
            </label>
          </div>

          <div class="d-flex gap-2">
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>

            <button type="button" class="btn btn-outline-secondary"
              :disabled="saving" @click="cancelEdit">
              Cancel
            </button>
          </div>
        </form>
      </template>
    </div>
  </main>
</template>