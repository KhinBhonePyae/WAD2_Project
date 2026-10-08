<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <nav class="ss-nav">
    <div class="container d-flex align-items-center justify-content-between py-2">
      <RouterLink to="/" class="ss-nav__brand">
        <span class="ss-nav__dot"></span> StudySpot <span class="ss-muted fw-normal">SG</span>
      </RouterLink>
      <div class="d-flex align-items-center gap-1 gap-sm-3">
        <RouterLink to="/places" class="nav-link px-2" data-test="nav-browse">Browse</RouterLink>
        <RouterLink to="/profile" class="nav-link px-2 d-none d-sm-inline">Saved</RouterLink>
        <RouterLink to="/login" class="btn btn-outline-primary btn-sm">Log in</RouterLink>
      </div>
    </div>
  </nav>

  <RouterView />

  <footer class="py-4 mt-5" style="background:var(--ss-surface);border-top:1px solid var(--ss-border)">
    <div class="container ss-meta d-flex flex-wrap justify-content-between gap-2">
      <span>StudySpot SG — IS216 G10 Team T3 · prototype</span>
      <span>Weather by Open-Meteo</span>
    </div>
  </footer>
</template>
