import { createRouter, createWebHistory } from 'vue-router'
import ConsultasView from '../views/ConsultasView.vue'
import DebugView from '../views/DebugView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'consultas',
      component: ConsultasView
    },
    {
      path: '/debug',
      name: 'debug',
      component: DebugView
    }
  ]
})

export default router
