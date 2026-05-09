import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'editor-new',
    component: () => import('@/pages/ConfigEditorPage.vue'),
    props: { configId: null },
  },
  {
    path: '/editor/:id',
    name: 'editor',
    component: () => import('@/pages/ConfigEditorPage.vue'),
    props: (route) => ({ configId: route.params.id as string }),
    meta: { requiresAuth: true },
  },
  {
    path: '/configs',
    name: 'configs',
    component: () => import('@/pages/ConfigListPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ensureInitialized()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.name === 'login' && auth.isLoggedIn) {
    return { name: 'configs' }
  }
  return true
})
