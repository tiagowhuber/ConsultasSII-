import { createRouter, createWebHistory } from 'vue-router'
import ConsultasView from '../views/ConsultasView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'consultas',
      component: ConsultasView
    }
  ]
})

export default router
