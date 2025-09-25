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
      const key = `${nota.rutProveedor}-${nota.folio}-${nota.tipoDte}`
      map.set(key, nota)
    })
    return map
  })

  // Helper function to generate composite key
  const getCompositeKey = (rutProveedor: string, folio: string, tipoDte: number): string => {
    return `${rutProveedor}-${folio}-${tipoDte}`
  }

  // Get nota by composite key
  const getNotaByCompositeKey = (rutProveedor: string, folio: string, tipoDte: number): Notas | undefined => {
    const key = getCompositeKey(rutProveedor, folio, tipoDte)
    return notasMap.value.get(key)
  }

  // Load all notas
  const loadAllNotas = async () => {
    try {
      loading.value = true
      error.value = null
      const response = await notasApi.getAllNotas()
      notas.value = response.data
      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading notas'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Load specific nota by composite key
  const loadNotaByCompositeKey = async (rutProveedor: string, folio: string, tipoDte: number) => {
    try {
      const response = await notasApi.getNotaByCompositeKey(rutProveedor, folio, tipoDte)
      const nota = response.data

      // Update local state
      const existingIndex = notas.value.findIndex(n =>
        n.rutProveedor === rutProveedor &&
        n.folio === folio &&
        n.tipoDte === tipoDte
      )

      if (existingIndex !== -1) {
        notas.value[existingIndex] = nota
      } else {
        notas.value.push(nota)
      }

      return nota
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading nota'
      throw err
    }
  }

  // Create nota
  const createNota = async (data: {
    rutProveedor: string
    folio: string
    tipoDte: number
    comentario?: string
    contabilizado?: boolean
  }) => {
    try {
      loading.value = true
      error.value = null
      const response = await notasApi.createNota(data)
      const newNota = response.data

      // Add to local state
      notas.value.push(newNota)

      return newNota
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error creating nota'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update nota
  const updateNota = async (
    rutProveedor: string,
    folio: string,
    tipoDte: number,
    data: {
      comentario?: string
      contabilizado?: boolean
    }
  ) => {
    try {
      loading.value = true
      error.value = null
      const response = await notasApi.updateNota(rutProveedor, folio, tipoDte, data)
      const updatedNota = response.data

      // Update local state
      const index = notas.value.findIndex(n =>
        n.rutProveedor === rutProveedor &&
        n.folio === folio &&
        n.tipoDte === tipoDte
      )

      if (index !== -1) {
        notas.value[index] = updatedNota
      } else {
        notas.value.push(updatedNota)
      }

      return updatedNota
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error updating nota'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update comment only
  const updateComment = async (rutProveedor: string, folio: string, tipoDte: number, comentario: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await notasApi.updateNotaComment(rutProveedor, folio, tipoDte, comentario)

      // Update local state
      const nota = getNotaByCompositeKey(rutProveedor, folio, tipoDte)

      if (nota) {
        nota.comentario = comentario
        nota.updatedAt = new Date().toISOString()
      } else {
        // Create local representation if it doesn't exist
        const newNota: Notas = {
          notaId: 0, // Will be updated when we fetch from server
          rutProveedor,
          folio,
          tipoDte,
          comentario,
          contabilizado: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        notas.value.push(newNota)

        // Try to fetch the actual nota from server to get the real ID
        try {
          await loadNotaByCompositeKey(rutProveedor, folio, tipoDte)
        } catch {
          // If it fails, the local representation is fine for now
        }
      }

      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error updating comment'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update contabilizado status only
  const updateContabilizado = async (rutProveedor: string, folio: string, tipoDte: number, contabilizado: boolean) => {
    try {
      loading.value = true
      error.value = null
      const response = await notasApi.updateNotaContabilizado(rutProveedor, folio, tipoDte, contabilizado)

      // Update local state
      const nota = getNotaByCompositeKey(rutProveedor, folio, tipoDte)

      if (nota) {
        nota.contabilizado = contabilizado
        nota.updatedAt = new Date().toISOString()
      } else {
        // Create local representation if it doesn't exist
        const newNota: Notas = {
          notaId: 0, // Will be updated when we fetch from server
          rutProveedor,
          folio,
          tipoDte,
          comentario: undefined,
          contabilizado,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        notas.value.push(newNota)

        // Try to fetch the actual nota from server to get the real ID
        try {
          await loadNotaByCompositeKey(rutProveedor, folio, tipoDte)
        } catch {
          // If it fails, the local representation is fine for now
        }
      }

      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error updating contabilizado status'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete nota
  const deleteNota = async (rutProveedor: string, folio: string, tipoDte: number) => {
    try {
      loading.value = true
      error.value = null
      const response = await notasApi.deleteNota(rutProveedor, folio, tipoDte)

      // Remove from local state
      const index = notas.value.findIndex(n =>
        n.rutProveedor === rutProveedor &&
        n.folio === folio &&
        n.tipoDte === tipoDte
      )

      if (index !== -1) {
        notas.value.splice(index, 1)
      }

      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error deleting nota'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Clear all notas
  const clearNotas = () => {
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
    getNotaByCompositeKey,
    getCompositeKey,

    // Actions
    loadAllNotas,
    loadNotaByCompositeKey,
    createNota,
    updateNota,
    updateComment,
    updateContabilizado,
    deleteNota,
    clearNotas
  }
})
