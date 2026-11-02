<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const email = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

async function sendResetLink() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value.trim()) {
    errorMessage.value = 'Please enter your email address.'
    return
  }

  try {
    loading.value = true

    const response = await axios.post(`${BASE_URL}/users/forgot-password`, {
      email: email.value.trim()
    })

    successMessage.value = response.data.message
  } catch (error) {
    errorMessage.value =
      error.response?.data?.error || 'Unable to send reset link. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="container auth-container">
      <div class="reset-card">
        <p class="small-heading">ACCOUNT RECOVERY</p>
        <h1>Forgot password?</h1>

        <p class="description">
          Enter the email address associated with your LockedIN account.
          We will send you a password reset link.
        </p>

        <div v-if="errorMessage" class="alert alert-danger">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="alert alert-success">
          {{ successMessage }}
        </div>

        <form @submit.prevent="sendResetLink">
          <div class="form-group">
            <label for="email" class="form-label">Email</label>

            <input
              id="email"
              v-model="email"
              type="email"
              class="form-control auth-input"
              placeholder="Enter your email"
              autocomplete="email"
            >
          </div>

          <button type="submit" class="btn auth-button" :disabled="loading">
            {{ loading ? 'Sending...' : 'Send reset link' }}
          </button>
        </form>

        <RouterLink to="/login" class="back-link">
          Back to login
        </RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - 70px);
  padding: 3rem 1rem;
  display: flex;
  align-items: center;
  background: var(--x-card);
  margin-bottom: -4rem;
}

.auth-container {
  display: flex;
  justify-content: center;
}

.reset-card {
  width: 100%;
  max-width: 520px;
  padding: 3rem;
  border: 1px solid var(--x-ink);
  border-radius: 28px;
  background: white;
  box-shadow: var(--x-pop);
}

.small-heading {
  margin-bottom: .5rem;
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .13em;
}

h1 {
  margin-bottom: 1rem;
  font-size: 2.2rem;
  font-weight: 800;
}

.description {
  margin-bottom: 2rem;
  color: var(--x-muted);
}

.form-group {
  margin-bottom: 1.4rem;
}

.form-label {
  margin-bottom: .55rem;
  font-weight: 700;
}

.auth-input {
  min-height: 54px;
  padding: .8rem 1rem;
  border: 1px solid var(--x-ink);
  border-radius: 14px;
  background: var(--x-card);
}

.auth-input:focus {
  border-color: var(--x-ink);
  background: white;
  box-shadow: 0 0 0 3px var(--x-lime);
}

.auth-button {
  width: 100%;
  min-height: 54px;
  border: none;
  border-radius: 14px;
  color: white;
  font-weight: 700;
  background: var(--x-orange);
  box-shadow: var(--x-pop);
}

.back-link {
  display: block;
  margin-top: 1.5rem;
  color: var(--x-ink);
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

@media (max-width: 575px) {
  .auth-page {
    padding: 1.25rem .75rem;
    align-items: flex-start;
  }

  .reset-card {
    padding: 2rem 1.25rem;
    border-radius: 20px;
  }

  h1 {
    font-size: 1.8rem;
  }
}
</style>