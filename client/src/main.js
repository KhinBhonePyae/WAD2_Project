import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Bootstrap first, then our theme so the theme can override it.
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/theme.css'

const app = createApp(App)
app.use(router)
app.mount('#app')
