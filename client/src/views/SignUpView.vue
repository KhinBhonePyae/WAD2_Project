<!-- Stub - owner: Khin Bhone Pyae (authentication and profile management).
The route and layout exist so the app's shape is complete; the form is not wired yet. -->

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function register() {
  errorMessage.value = ''

  if (!name.value || !email.value || !password.value || !confirmPassword.value) {
    errorMessage.value = 'Please fill in all fields.'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  try {
    loading.value = true

    await axios.post(`${BASE_URL}/users/register`, {
      name: name.value,
      email: email.value,
      password: password.value
    })

    router.push('/login')
  } catch (error) {
    if (error.response?.data?.error) {
      errorMessage.value = error.response.data.error
    } else {
      errorMessage.value = 'Unable to create account. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="container ss-section">
    <div class="ss-card p-4 p-md-5 mx-auto" style="max-width: 500px">
      <div class="mb-4">
        <h1 class="h3 mb-2">Create an account</h1>
        <p class="ss-muted mb-0">Join StudySpot SG and save your study preferences.</p>
      </div>

      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="register">
        <div class="mb-3">
          <label for="name" class="form-label">Name</label>
          <input id="name" v-model="name" type="text" class="form-control"
            placeholder="Enter your name">
        </div>

        <div class="mb-3">
          <label for="email" class="form-label">Email</label>
          <input id="email" v-model="email" type="email" class="form-control"
            placeholder="Enter your email">
        </div>

        <div class="mb-3">
          <label for="password" class="form-label">Password</label>
          <input id="password" v-model="password" type="password" class="form-control"
            placeholder="Enter your password">
        </div>

        <div class="mb-4">
          <label for="confirmPassword" class="form-label">Confirm password</label>
          <input id="confirmPassword" v-model="confirmPassword" type="password" class="form-control"
            placeholder="Enter your password again">
        </div>

        <button type="submit" class="btn btn-primary w-100" :disabled="loading">
          {{ loading ? 'Creating account...' : 'Sign up' }}
        </button>
      </form>

      <div class="text-center mt-4">
        <span class="ss-muted">Already have an account? </span>
        <RouterLink to="/login">Log in</RouterLink>
      </div>
    </div>
  </main>
</template>