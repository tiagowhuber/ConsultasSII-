import { defineStore } from 'pinia';
import { siiApi } from '@/services/api';

export const useSiiStore = defineStore('sii', {
  state: () => ({
    loading: false,
    error: null as string | null,
    lastFetchInfo: null as {
      year: string;
      month: string;
      timestamp: Date;
    } | null,
  }),

  actions: {
    async fetchAndStore(year: string, month: string) {
      this.loading = true;
      this.error = null;

      try {
        console.log(`Fetching SII data for ${year}/${month}...`);

        const response = await siiApi.fetchAndStore(year, month);

        this.lastFetchInfo = {
          year,
          month,
          timestamp: new Date()
        };

        console.log('SII data fetch completed:', response.data);
        return response.data;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          || 'Error al obtener datos de SII';
        this.error = errorMessage;
        console.error('Error fetching SII data:', error);
        throw new Error(errorMessage);
      } finally {
        this.loading = false;
      }
    },

    clearError() {
      this.error = null;
    }
  },

  getters: {
    isLoading: (state) => state.loading,
    hasError: (state) => !!state.error,
    getLastFetchInfo: (state) => state.lastFetchInfo
  }
});
