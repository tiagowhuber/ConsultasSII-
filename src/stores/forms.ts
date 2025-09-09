/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'
import type { FormRequest } from '../types/forms'
import type { FormResponse } from '../types/api'

export const useFormsStore = defineStore('forms', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const data = ref<FormResponse | null>(null)

  const getAll = async (month: string = '08', year: string = '2025') => {
    loading.value = true
    error.value = null

    try {
      const requestBody: FormRequest = {
        RutUsuario: '77147627-9',
        PasswordSII: import.meta.env.VITE_SII_PASSWORD,
        RutEmpresa: '77147627-9',
        Ambiente: 1,
      }

      const response = await api.post<FormResponse>(
        `/api/RCV/compras/${month}/${year}`,
        requestBody,
        {
          headers: {
            Authorization: import.meta.env.VITE_API_KEY,
          },
        },
      )

      data.value = response.data
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    error,
    data,
    // Actions
    getAll,
  }
})
