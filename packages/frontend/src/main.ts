import { createApp } from 'vue'
import '@/styles/global.scss'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'

createApp(App)
    .use(ElementPlus)
    .use(createPinia())
    .mount('#app')
