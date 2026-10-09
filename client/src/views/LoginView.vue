<!-- Stub - owner: Khin Bhone Pyae (authentication and profile management).
The route and layout exist so the app's shape is complete; the form is not wired yet.
 -->

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const router = useRouter()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function login() {
  errorMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Please enter your email and password.'
    return
  }

  try {
    loading.value = true

    const response = await axios.post(`${BASE_URL}/users/login`, {
      email: email.value,
      password: password.value
    })

    localStorage.setItem('token', response.data.token)
    localStorage.setItem('user', JSON.stringify(response.data.user))

    window.dispatchEvent(new Event('user-login'))

    router.push('/')

    } catch (error) {
      if (error.response?.data?.error) {
        errorMessage.value = error.response.data.error
      } else {
        errorMessage.value = 'Unable to log in. Please try again.'
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
        <h1 class="h3 mb-2">Log in</h1>
        <p class="ss-muted mb-0">Welcome back to StudySpot SG.</p>
      </div>

      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="login">
        <div class="mb-3">
          <label for="email" class="form-label">Email</label>
          <input id="email" v-model="email" type="email" class="form-control"
            placeholder="Enter your email">
        </div>

        <div class="mb-4">
          <label for="password" class="form-label">Password</label>
          <input id="password" v-model="password" type="password" class="form-control"
            placeholder="Enter your password">
        </div>

        <button type="submit" class="btn btn-primary w-100" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Log in' }}
        </button>
      </form>

      <div class="text-center mt-4">
        <span class="ss-muted">Don't have an account? </span>
        <RouterLink to="/signup">Sign up</RouterLink>
      </div>
    </div>
  </main>
</template>
