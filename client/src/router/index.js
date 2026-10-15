import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'

import HomeView from '../views/HomeView.vue'
import CatalogueView from '../views/CatalogueView.vue'
import PlaceDetailView from '../views/PlaceDetailView.vue'
import LoginView from '../views/LoginView.vue'
import SignUpView from '../views/SignUpView.vue'
import ProfileView from '../views/ProfileView.vue'
import PlaceFormView from '../views/PlaceFormView.vue'
import AdminPlacesView from '../views/AdminPlacesView.vue'
import AdminUsersView from '../views/AdminUsersView.vue'
import SavedView from '../views/SavedView.vue'
import SearchView from '../views/SearchView.vue'

import { BASE_URL, authConfig } from '../utils/api.js'

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
    { path: '/admin/users', component: AdminUsersView, meta: { requiresAdmin: true } },

    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],

  scrollBehavior() {
    return { top: 0 }
  }
})

async function getFreshUser() {
  const token = localStorage.getItem('token')

  if (!token) return null

  try {
    const { data } = await axios.get(`${BASE_URL}/users/profile`, authConfig())

    localStorage.setItem('user', JSON.stringify(data))

    // Tell App.vue that the locally stored user has changed
    window.dispatchEvent(new Event('user-login'))

    return data
  } catch (e) {
    if (e.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('user-login'))
      return null
    }

    console.error('Could not verify current user role', e)

    try {
      return JSON.parse(localStorage.getItem('user'))
    } catch {
      return null
    }
  }
}

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true

  const token = localStorage.getItem('token')

  if (!token) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }

  /*
   * Do NOT trust the role saved in localStorage here.
   * Ask the backend for the current MongoDB user instead.
   */
  const currentUser = await getFreshUser()

  if (!currentUser) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }

  if (currentUser.role !== 'admin') {
    return { path: '/places' }
  }

  return true
})

export default router