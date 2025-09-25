import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { notasApi } from '../services/api'
import type { Notas } from '../types/api'

export const useNotasStore = defineStore('notas', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notas = ref<Notas[]>([])

  // Computed properties for easy access
  const notasMap = computed(() => {
    const map = new Map<string, Notas>()
    notas.value.forEach(nota => {
      map.set(nota.folio, nota)
    })
    return map
  })

  // Get nota by folio
  const getNotaByFolio = (folio: string): Notas | undefined => {
    return notasMap.value.get(folio)
  }

  // Actions
  const loadAllNotas = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const response = await notasApi.getAllNotas()
      notas.value = response.data
    } catch (err: unknown) {
      console.error('Error loading notas:', err)
      error.value = (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || 'Error loading notas'
    } finally {
      loading.value = false
    }
  }

  // Load nota by folio
  const loadNotaByFolio = async (folio: string): Promise<Notas | null> => {
    loading.value = true
    error.value = null
    try {
      const response = await notasApi.getNotaByFolio(folio)

      // Update or add to local store
      const existingIndex = notas.value.findIndex(n => n.folio === folio)
      if (existingIndex >= 0) {
        notas.value[existingIndex] = response.data
      } else {
        notas.value.push(response.data)
      }

      return response.data
    } catch (err: unknown) {
      console.error('Error loading nota:', err)
      error.value = (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || 'Error loading nota'
      return null
    } finally {
      loading.value = false
    }
  }

  // Create nota
  const createNota = async (data: {
    folio: string
    comentario?: string
    contabilizado?: boolean
  }): Promise<Notas | null> => {
    loading.value = true
    error.value = null
    try {
      const response = await notasApi.createNota(data)
      const newNota = response.data

      // Add to local state
      notas.value.push(newNota)

      return newNota
    } catch (err: unknown) {
      console.error('Error creating nota:', err)
      error.value = (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || 'Error creating nota'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update nota
  const updateNota = async (
    folio: string,
    data: {
      comentario?: string
      contabilizado?: boolean
    }
  ): Promise<Notas | null> => {
    loading.value = true
    error.value = null
    try {
      const response = await notasApi.updateNota(folio, data)
      const updatedNota = response.data

      // Update local state
      const index = notas.value.findIndex(n => n.folio === folio)
      if (index !== -1) {
        notas.value[index] = updatedNota
      } else {
        notas.value.push(updatedNota)
      }

      return updatedNota
    } catch (err: unknown) {
      console.error('Error updating nota:', err)
      error.value = (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || 'Error updating nota'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update comment only
  const updateComment = async (folio: string, comentario: string): Promise<Notas | null> => {
    loading.value = true
    error.value = null
    try {
      const response = await notasApi.updateNotaComment(folio, comentario)

      // Update local state
      const nota = getNotaByFolio(folio)
      if (nota) {
        nota.comentario = comentario
        nota.updatedAt = new Date().toISOString()
      } else {
        // Create local representation if it doesn't exist
        const newNota: Notas = {
          notaId: 0, // Will be updated when we fetch from server
          folio,
          comentario,
          contabilizado: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        notas.value.push(newNota)

        // Try to fetch the actual nota from server to get the real ID
        try {
          await loadNotaByFolio(folio)
        } catch {
          // If it fails, the local representation is fine for now
        }
      }

      return response.data
    } catch (err: unknown) {
      console.error('Error updating comment:', err)
      error.value = (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || 'Error updating comment'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update contabilizado status only
  const updateContabilizado = async (folio: string, contabilizado: boolean): Promise<Notas | null> => {
    loading.value = true
    error.value = null
    try {
      const response = await notasApi.updateNotaContabilizado(folio, contabilizado)

      // Update local state
      const nota = getNotaByFolio(folio)
      if (nota) {
        nota.contabilizado = contabilizado
        nota.updatedAt = new Date().toISOString()
      } else {
        // Create local representation if it doesn't exist
        const newNota: Notas = {
          notaId: 0, // Will be updated when we fetch from server
          folio,
          comentario: undefined,
          contabilizado,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        notas.value.push(newNota)

        // Try to fetch the actual nota from server to get the real ID
        try {
          await loadNotaByFolio(folio)
        } catch {
          // If it fails, the local representation is fine for now
        }
      }

      return response.data
    } catch (err: unknown) {
      console.error('Error updating contabilizado status:', err)
      error.value = (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || 'Error updating contabilizado status'
      return null
    } finally {
      loading.value = false
    }
  }

  // Delete nota
  const deleteNota = async (folio: string): Promise<boolean> => {
    loading.value = true
    error.value = null
    try {
      await notasApi.deleteNota(folio)

      // Remove from local state
      const index = notas.value.findIndex(n => n.folio === folio)
      if (index !== -1) {
        notas.value.splice(index, 1)
      }

      return true
    } catch (err: unknown) {
      console.error('Error deleting nota:', err)
      error.value = (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || 'Error deleting nota'
      return false
    } finally {
      loading.value = false
    }
  }

  // Clear all notas
  const clearNotas = (): void => {
    notas.value = []
    error.value = null
  }

  return {
    // State
    loading,
    error,
    notas,

    // Computed
    notasMap,

    // Getters
    getNotaByFolio,

    // Actions
    loadAllNotas,
    loadNotaByFolio,
    createNota,
    updateNota,
    updateComment,
    updateContabilizado,
    deleteNota,
    clearNotas
  }
})
