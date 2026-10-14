import { createRouter, createWebHistory } from 'vue-router'

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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

router.beforeEach((to) => {
  if (!to.meta.requiresAdmin) return true

  const token = localStorage.getItem('token')
  const user = getStoredUser()

  // Not logged in
  if (!token) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }

  // Logged in but not admin
  if (user?.role !== 'admin') {
    return { path: '/places' }
  }

  return true
})

export default router