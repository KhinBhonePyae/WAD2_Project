import { createApp } from 'vue'  // Library: Vue 3: open-source JavaScript framework (MIT)
import App from './App.vue'
import router from './router'

// Bootstrap first, then our theme so the theme can override it.
import 'bootstrap/dist/css/bootstrap.min.css'  // Library: Bootstrap 5: open-source CSS/JS framework (MIT)
import 'bootstrap/dist/js/bootstrap.bundle.min.js'  // Library: Bootstrap 5: open-source CSS/JS framework (MIT)
import './assets/theme.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

// Installable app: register the service worker on the built site only
// (in dev it would cache files you are still editing)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
