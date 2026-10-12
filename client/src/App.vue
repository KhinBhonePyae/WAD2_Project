<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'

const router = useRouter()
const user = ref(JSON.parse(localStorage.getItem('user')))

function logout() {
  localStorage.removeItem('user')
  localStorage.removeItem('token')
  user.value = null
  router.push('/')
}

function updateUser() {
  user.value = JSON.parse(localStorage.getItem('user'))
}

onMounted(() => {
  window.addEventListener('user-login', updateUser)
})

onUnmounted(() => {
  window.removeEventListener('user-login', updateUser)
})

</script>

<template>
  <nav class="ss-nav">
    <div class="container d-flex align-items-center justify-content-between py-2">
      <RouterLink to="/" class="ss-nav__brand">
        <span class="ss-nav__dot"></span> StudySpot <span class="ss-muted fw-normal">SG</span>
      </RouterLink>
      <div class="d-flex align-items-center gap-1 gap-sm-3">
        <RouterLink to="/places" class="nav-link px-2" data-test="nav-browse">Browse</RouterLink>
        <RouterLink to="/saved" class="nav-link px-2 d-none d-sm-inline">Saved</RouterLink>
        
        <template v-if="!user">
          <RouterLink to="/signup" class="nav-link px-2">Sign up</RouterLink>
          <RouterLink to="/login" class="btn btn-outline-primary btn-sm">Log in</RouterLink>
        </template>

        <template v-else>
          <RouterLink to="/profile" class="nav-link px-2">{{ user.name }}</RouterLink>
          <button class="btn btn-outline-primary btn-sm" @click="logout">Log out</button>
        </template>

      </div>
    </div>
  </nav>

  <RouterView />

  <footer class="py-4" style="background:var(--ss-surface);border-top:1px solid var(--ss-border)">
    <div class="container ss-meta d-flex flex-wrap justify-content-between gap-2">
      <span>StudySpot SG — IS216 G10 Team T3 · prototype</span>
      <span>Weather by Open-Meteo</span>
    </div>
  </footer>
</template>
