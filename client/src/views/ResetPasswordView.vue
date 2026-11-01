<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const route = useRoute()
const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

async function resetPassword() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!newPassword.value || !confirmPassword.value) {
    errorMessage.value = 'Please complete both password fields.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  try {
    loading.value = true

    const response = await axios.post(
      `${BASE_URL}/users/reset-password/${route.params.token}`,
      {
        newPassword: newPassword.value,
        confirmPassword: confirmPassword.value
      }
    )

    successMessage.value = response.data.message
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error) {
    errorMessage.value =
      error.response?.data?.error || 'Unable to reset password. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="container auth-container">
      <div class="reset-card">
        <p class="small-heading">ACCOUNT SECURITY</p>
        <h1>Reset password</h1>

        <p class="description">
          Choose a new password for your LockedIN account.
        </p>

        <div v-if="errorMessage" class="alert alert-danger">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="alert alert-success">
          {{ successMessage }}
        </div>

        <form @submit.prevent="resetPassword">
          <div class="form-group">
            <label for="newPassword" class="form-label">New password</label>

            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              class="form-control auth-input"
              autocomplete="new-password"
            >
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">
              Confirm new password
            </label>

            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              class="form-control auth-input"
              autocomplete="new-password"
            >
          </div>

          <button type="submit" class="btn auth-button" :disabled="loading">
            {{ loading ? 'Resetting...' : 'Reset password' }}
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