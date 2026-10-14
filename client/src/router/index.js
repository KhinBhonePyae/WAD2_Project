import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'
import { BASE_URL, authConfig } from '../utils/api.js'

import HomeView from '../views/HomeView.vue'
import CatalogueView from '../views/CatalogueView.vue'
import PlaceDetailView from '../views/PlaceDetailView.vue'
import LoginView from '../views/LoginView.vue'
import SignUpView from '../views/SignUpView.vue'
import ProfileView from '../views/ProfileView.vue'
import PlaceFormView from '../views/PlaceFormView.vue'
import AdminPlacesView from '../views/AdminPlacesView.vue'
import SavedView from '../views/SavedView.vue'
import SearchView from '../views/SearchView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    { path: '/', component: HomeView },
    { path: '/places', component: CatalogueView },
    { path: '/places/:id', component: PlaceDetailView },
    { path: '/login', component: LoginView },
    { path: '/signup', component: SignUpView },
    { path: '/profile', component: ProfileView },
    { path: '/saved', component: SavedView },
    { path: '/search', component: SearchView },

    { path: '/admin/places', component: AdminPlacesView, meta: { requiresAdmin: true } },
    { path: '/admin/places/new', component: PlaceFormView, meta: { requiresAdmin: true } },
    { path: '/admin/places/:id/edit', component: PlaceFormView, meta: { requiresAdmin: true } },

    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],

  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true

  const token = localStorage.getItem('token')

  if (!token) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }

  try {
    const { data: user } = await axios.get(`${BASE_URL}/users/profile`, authConfig())

    localStorage.setItem('user', JSON.stringify(user))

    if (user.role !== 'admin') return { path: '/places' }

    return true
  } catch (e) {
    localStorage.removeItem('user')
    localStorage.removeItem('token')

    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }
})

export default router