import { createRouter, createWebHistory } from 'vue-router'
import DebugView from '../views/DebugView.vue'
import ListaFacturasView from '@/views/ListaFacturasView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'facturas',
      component: ListaFacturasView
    },
    {
      path: '/debug',
      name: 'debug',
      component: DebugView
    }
  ]
})

export default router
