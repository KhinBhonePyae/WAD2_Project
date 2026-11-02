import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SearchView from '../views/SearchView.vue'
import PlaceDetailView from '../views/PlaceDetailView.vue'
import LoginView from '../views/LoginView.vue'
import SignUpView from '../views/SignUpView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import ProfileView from '../views/ProfileView.vue'
import SavedView from '../views/SavedView.vue'
import AdminPlacesView from '../views/AdminPlacesView.vue'
import PlaceFormView from '../views/PlaceFormView.vue'
import AdminUsersView from '../views/AdminUsersView.vue'
import AdminReportsView from '../views/AdminReportsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    
    // Main search page (replaced /places)
    { path: '/search', component: SearchView },
    
    // Redirect old /places links to /search
    { path: '/places', redirect: '/search' },
    
    // Individual place details
    { path: '/places/:id', component: PlaceDetailView },
    
    { path: '/login', component: LoginView },
    { path: '/signup', component: SignUpView },
    { path: '/forgot-password', component: ForgotPasswordView },
    { path: '/reset-password/:token', component: ResetPasswordView },
    { path: '/profile', component: ProfileView },
    { path: '/saved', component: SavedView },

    { path: '/admin/places', component: AdminPlacesView, meta: { requiresAdmin: true } },
    { path: '/admin/places/new', component: PlaceFormView, meta: { requiresAdmin: true } },
    { path: '/admin/places/:id/edit', component: PlaceFormView, meta: { requiresAdmin: true } },
    { path: '/admin/users', component: AdminUsersView, meta: { requiresAdmin: true } },
    { path: '/admin/reports', component: AdminReportsView, meta: { requiresAdmin: true } },

    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router