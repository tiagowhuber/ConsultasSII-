import axios from 'axios';
import type { Empresa, Periodo, ResumenCompras, DetalleCompras, Proveedor, TipoDte, Notas } from '../types/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 300000, // 30 seconds for API calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// DTE API methods
export const dteApi = {
  // Empresa endpoints
  getAllEmpresas: () => api.get<Empresa[]>('/api/dte/empresas'),
  getEmpresaByRut: (rut: string) => api.get<Empresa>(`/api/dte/empresas/${rut}`),

  // Periodo endpoints
  getPeriodosByEmpresa: (rutEmpresa: string, anio?: string, mes?: string) => {
    const params = new URLSearchParams();
    if (anio) params.append('anio', anio);
    if (mes) params.append('mes', mes);
    const queryString = params.toString();
    return api.get<Periodo[]>(`/api/dte/empresas/${rutEmpresa}/periodos${queryString ? `?${queryString}` : ''}`);
  },

  // Resumen compras endpoints
  getResumenCompras: (periodoId?: string) => {
    const endpoint = periodoId ? `/api/dte/resumen-compras/${periodoId}` : '/api/dte/resumen-compras';
    return api.get<ResumenCompras[]>(endpoint);
  },

  // Detalle compras endpoints
  getDetalleCompras: (periodoId?: string, filters?: {
    rutProveedor?: string;
    tipoDte?: string;
    fechaInicio?: string;
    fechaFin?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    // Set a high default limit to get all records
    if (!filters?.limit) {
      params.append('limit', '10000');
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    const queryString = params.toString();
    const endpoint = periodoId ? `/api/dte/detalle-compras/${periodoId}` : '/api/dte/detalle-compras';
    return api.get<{
      data: DetalleCompras[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`${endpoint}${queryString ? `?${queryString}` : ''}`);
  },

  // Proveedor endpoints
  getAllProveedores: (search?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const queryString = params.toString();
    return api.get<Proveedor[]>(`/api/dte/proveedores${queryString ? `?${queryString}` : ''}`);
  },

  // Tipo DTE endpoints
  getAllTiposDte: () => api.get<TipoDte[]>('/api/dte/tipos-dte'),
};

// Notas API methods
export const notasApi = {
  // Get all notas
  getAllNotas: () => api.get<Notas[]>('/api/notas'),

  // Get nota by folio
  getNotaByFolio: (folio: string) => api.get<Notas>(`/api/notas/${folio}`),

  // Create nota
  createNota: (data: {
    folio: string;
    comentario?: string;
    contabilizado?: boolean;
    pagado?: boolean;
  }) => api.post<Notas>('/api/notas', data),

  // Update nota
  updateNota: (folio: string, data: {
    comentario?: string;
    contabilizado?: boolean;
    pagado?: boolean;
  }) => api.put<Notas>(`/api/notas/${folio}`, data),

  // Update nota comment
  updateNotaComment: (folio: string, comentario: string) =>
    api.put(`/api/notas/${folio}/comment`, { comentario }),

  // Update nota contabilizado status
  updateNotaContabilizado: (folio: string, contabilizado: boolean) =>
    api.put(`/api/notas/${folio}/contabilizado`, { contabilizado }),

  // Update nota pagado status
  updateNotaPagado: (folio: string, pagado: boolean) =>
    api.put(`/api/notas/${folio}/pagado`, { pagado }),

  // Delete nota
  deleteNota: (folio: string) =>
    api.delete(`/api/notas/${folio}`),
};

// SII API methods
export const siiApi = {
  // Fetch and store SII data
  fetchAndStore: (year: string, month: string) =>
    api.post(`/api/sii/fetch-and-store-manual/${year}/${month}`),

  // Get API call counter
  getCallCount: () =>
    api.get<{
      message: string;
      fetchSIIDataCount: number;
      allCounters: Array<{
        functionName: string;
        callCount: number;
        lastCalledAt: string;
        createdAt: string;
        updatedAt: string;
      }>;
      timestamp: string;
    }>('/api/sii/call-count'),
};

export default api;
