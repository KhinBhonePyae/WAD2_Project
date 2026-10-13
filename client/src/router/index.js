import { createRouter, createWebHistory } from 'vue-router'
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
    { path: '/admin/places', component: AdminPlacesView },
    { path: '/admin/places/new', component: PlaceFormView },
    { path: '/admin/places/:id/edit', component: PlaceFormView },
    { path: '/places/:id', component: PlaceDetailView },
    { path: '/login', component: LoginView },
    { path: '/signup', component: SignUpView },
    { path: '/profile', component: ProfileView },
    { path: '/saved', component: SavedView },
    { path: '/search', component: SearchView },
    { path: '/:pathMatch(.*)*', redirect: '/' },   // unknown URLs go home instead of a blank page
  ],
  scrollBehavior() { return { top: 0 } },
})

export default router
