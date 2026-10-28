<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const router = useRouter()
const step = ref(1)
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const loading = ref(false)

const preferences = ref({
  wifiRequired: false,
  socketsRequired: false,
  quietPreferred: false,
  indoorPreferred: false
})

function goToPreferences() {
  errorMessage.value = ''
  if (!name.value.trim() || !email.value.trim() || !password.value || !confirmPassword.value) {
    errorMessage.value = 'Please fill in all fields.'
    return
  }
  if (name.value.trim().length > 60) {
    errorMessage.value = 'Name must be 60 characters or fewer.'
    return
  }
  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  step.value = 2
}

async function register() {
  errorMessage.value = ''
  try {
    loading.value = true
    await axios.post(`${BASE_URL}/users/register`, {
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      preferences: preferences.value
    })

    const response = await axios.post(`${BASE_URL}/users/login`, {
      email: email.value,
      password: password.value
    })

    localStorage.setItem('token', response.data.token)
    localStorage.setItem('user', JSON.stringify(response.data.user))
    window.dispatchEvent(new Event('user-login'))
    router.push('/')
  } catch (error) {
    errorMessage.value = error.response?.data?.error || 'Unable to create account. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="background-circle circle-one"></div>
    <div class="background-circle circle-two"></div>

    <div class="container auth-container">
      <div class="auth-card">
        <section class="auth-side">
          <div class="side-content">
            <h1>Ready to Lock IN?</h1>
          </div>
        </section>

        <section class="auth-form">
          <div class="form-heading">
            <span class="small-heading">{{ step === 1 ? 'GET STARTED' : 'STEP 2' }}</span>
            <h2>{{ step === 1 ? 'Create account' : 'Study preferences' }}</h2>
          </div>

          <div v-if="errorMessage" class="alert alert-danger auth-alert" role="alert" data-test="auth-error">{{ errorMessage }}</div>

          <form v-if="step === 1" @submit.prevent="goToPreferences">
            <div class="form-group">
              <label for="name" class="form-label">Name</label>
              <input id="name" v-model="name" type="text" class="form-control auth-input" placeholder="Enter your name"
                autocomplete="name" maxlength="60">
            </div>

            <div class="form-group">
              <label for="email" class="form-label">Email</label>
              <input id="email" v-model="email" type="email" class="form-control auth-input"
                placeholder="Enter your email" autocomplete="email">
            </div>

            <div class="form-group">
              <label for="password" class="form-label">Password</label>
              <input id="password" v-model="password" type="password" class="form-control auth-input"
                placeholder="At least 8 characters" autocomplete="new-password">
            </div>

            <div class="form-group">
              <label for="confirmPassword" class="form-label">Confirm password</label>
              <input id="confirmPassword" v-model="confirmPassword" type="password" class="form-control auth-input"
                placeholder="Confirm your password" autocomplete="new-password">
            </div>

            <button type="submit" class="btn auth-button" data-test="signup-next">Next</button>
          </form>

          <form v-else @submit.prevent="register">
            <div class="preference-list">
              <label class="preference-item">
                <span>Wi-Fi</span>
                <input v-model="preferences.wifiRequired" class="form-check-input" type="checkbox" data-test="pref-wifi">
              </label>

              <label class="preference-item">
                <span>Power Sockets</span>
                <input v-model="preferences.socketsRequired" class="form-check-input" type="checkbox">
              </label>

              <label class="preference-item">
                <span>Quiet Environment</span>
                <input v-model="preferences.quietPreferred" class="form-check-input" type="checkbox">
              </label>

              <label class="preference-item">
                <span>Indoor Seating</span>
                <input v-model="preferences.indoorPreferred" class="form-check-input" type="checkbox">
              </label>
            </div>

            <div class="step-actions">
              <button type="button" class="secondary-step-button" :disabled="loading" @click="step = 1">Back</button>
              <button type="submit" class="btn auth-button create-button" :disabled="loading" data-test="signup-submit">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                {{ loading ? 'Creating account...' : 'Create account' }}
              </button>
            </div>
          </form>

          <template v-if="step === 1">
            <div class="auth-divider">
              <span></span>
              <p>Already have an account?</p>
              <span></span>
            </div>
            <RouterLink to="/login" class="secondary-button">Log in</RouterLink>
          </template>
        </section>
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
  position: relative;
  overflow: hidden;
  background: var(--x-card);
}

.auth-container {
  position: relative;
  z-index: 2;
}

.auth-card {
  width: 100%;
  max-width: 1050px;
  min-height: 680px;
  margin: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border: 1px solid var(--x-ink);
  border-radius: 28px;
  background: white;
  box-shadow: var(--x-pop);
}

.auth-side {
  padding: 3rem;
  display: flex;
  flex-direction: column;
  color: var(--x-ink);
  border-right: var(--x-line);
  position: relative;
  overflow: hidden;
  background: var(--x-orange);
}

.auth-side::before,
.auth-side::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, .06);
}

.auth-side::before {
  width: 270px;
  height: 270px;
  right: -100px;
  bottom: -90px;
}

.auth-side::after {
  width: 170px;
  height: 170px;
  left: -80px;
  top: 80px;
}

.side-content {
  margin: auto 0;
  position: relative;
  z-index: 1;
}

.side-content h1 {
  max-width: 430px;
  margin: 0;
  font-size: clamp(2.4rem, 4vw, 3.4rem);
  line-height: 1.08;
  font-weight: 800;
}

.auth-form {
  padding: 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.form-heading {
  margin-bottom: 1.7rem;
}

.small-heading {
  color: var(--x-ink);
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .13em;
}

.form-heading h2 {
  margin: .45rem 0 0;
  color: var(--x-ink);
  font-size: 2.2rem;
  font-weight: 800;
}

.form-group {
  margin-bottom: 1.15rem;
}

.form-label {
  margin-bottom: .5rem;
  color: var(--x-ink);
  font-weight: 700;
}

.auth-input {
  min-height: 52px;
  padding: .75rem 1rem;
  border: 1px solid var(--x-ink);
  border-radius: 14px;
  background: var(--x-card);
  transition: .2s ease;
}

.auth-input:focus {
  border-color: var(--x-ink);
  background: white;
  box-shadow: 0 0 0 3px var(--x-lime);
}

.auth-button {
  width: 100%;
  min-height: 54px;
  margin-top: .3rem;
  border: none;
  border-radius: 14px;
  color: white;
  font-weight: 700;
  background: var(--x-orange);
  box-shadow: var(--x-pop);
  transition: .2s ease;
}

.auth-button:hover:not(:disabled) {
  color: white;
  background: var(--x-orange);
  transform: translateY(-2px);
}

.auth-divider {
  margin: 1.5rem 0;
  display: flex;
  align-items: center;
  gap: .8rem;
}

.auth-divider span {
  height: 1px;
  flex: 1;
  background: var(--x-paper);
}

.auth-divider p {
  margin: 0;
  color: var(--x-muted);
  font-size: .85rem;
  white-space: nowrap;
}

.secondary-button {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--x-ink);
  border-radius: 14px;
  color: var(--x-ink);
  font-weight: 700;
  text-decoration: none;
  transition: .2s ease;
}

.secondary-button:hover {
  color: var(--x-ink);
  background: var(--x-paper);
}

.preference-list {
  display: flex;
  flex-direction: column;
  gap: .85rem;
}

.preference-item {
  min-height: 58px;
  padding: .9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--x-ink);
  border-radius: 14px;
  color: var(--x-ink);
  font-weight: 700;
  cursor: pointer;
  background: var(--x-card);
  transition: .2s ease;
}

.preference-item .form-check-input {
  width: 1.4rem;
  height: 1.4rem;
  margin: 0;
  flex-shrink: 0;
  border: 1px solid var(--x-ink);
  cursor: pointer;
  box-shadow: none;
}

.preference-item .form-check-input:checked {
  background-color: var(--x-lime);
  border-color: var(--x-ink);
}

.preference-item .form-check-input:focus {
  border-color: var(--x-ink);
  box-shadow: 0 0 0 3px var(--x-lime);
}

.step-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: .8rem;
}

.secondary-step-button {
  min-height: 54px;
  flex: 0 0 110px;
  padding: 0 1.2rem;
  border: 1px solid var(--x-ink);
  border-radius: 14px;
  color: var(--x-ink);
  font-weight: 700;
  background: white;
}

.create-button {
  flex: 1;
  margin-top: 0;
}

.auth-alert {
  border-radius: 12px;
}

.background-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.circle-one {
  width: 260px;
  height: 260px;
  top: -100px;
  right: 4%;
  background: rgba(214, 209, 239, .3);
}

.circle-two {
  width: 220px;
  height: 220px;
  left: 3%;
  bottom: -90px;
  background: rgba(211, 235, 228, .4);
}

@media (max-width: 991px) {
  .auth-card {
    max-width: 720px;
    grid-template-columns: 1fr;
  }

  .auth-side {
    min-height: 180px;
    padding: 2rem;
  }

  .side-content {
    margin: auto 0;
  }

  .side-content h1 {
    margin: 0;
    font-size: 2.3rem;
  }

  .auth-form {
    padding: 2.5rem;
  }
}

@media (max-width: 575px) {
  .auth-page {
    padding: 1rem .75rem;
    align-items: flex-start;
  }

  .auth-card {
    min-height: 0;
    border-radius: 20px;
  }

  .auth-side {
    min-height: 135px;
    padding: 1.4rem;
  }

  .side-content h1 {
    font-size: 1.8rem;
  }

  .auth-form {
    padding: 1.6rem 1.2rem;
  }

  .form-heading {
    margin-bottom: 1.3rem;
  }

  .form-heading h2 {
    font-size: 1.7rem;
  }

  .auth-divider p {
    font-size: .78rem;
  }

  .preference-list {
    gap: .65rem;
  }

  .preference-item {
    min-height: 54px;
    padding: .8rem .9rem;
    border-radius: 12px;
    font-size: .95rem;
  }

  .preference-item .form-check-input {
    width: 1.3rem;
    height: 1.3rem;
  }

  .step-actions {
    gap: .65rem;
  }

  .secondary-step-button {
    min-height: 50px;
    flex-basis: 90px;
    padding: 0 .8rem;
  }

  .create-button {
    min-height: 50px;
    font-size: .9rem;
  }
}
</style>