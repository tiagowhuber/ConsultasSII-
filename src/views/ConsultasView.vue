<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useFormsStore } from '@/stores/dte';
import type { DetalleCompra, ResumenCompra } from '@/types/api';

const formsStore = useFormsStore();

// Filter and sorting state
const filters = ref({
  rutProveedor: '',
  razonSocial: '',
  tipoDte: '',
  estado: '',
  fechaDesde: '',
  fechaHasta: '',
  montoMinimo: '',
  montoMaximo: ''
});

const sortConfig = ref({
  field: 'fechaEmision' as keyof DetalleCompra,
  direction: 'desc' as 'asc' | 'desc'
});

const showFilters = ref(false);

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
};

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-CL');
};

// Load data on component mount
onMounted(async () => {
  try {
    // Try to load some reference data first
    await Promise.allSettled([
      formsStore.loadTiposDte(),
      formsStore.loadProveedores()
    ]);

    // Load main data
    await formsStore.getAll();
  } catch (error) {
    console.error('Error loading data:', error);
  }
});

// Computed properties
const caratula = computed(() => formsStore.data?.caratula);
const resumenes = computed((): ResumenCompra[] => formsStore.data?.compras.resumenes || []);

// Filtered and sorted detalle compras
const filteredDetalleCompras = computed((): DetalleCompra[] => {
  let compras = formsStore.data?.compras.detalleCompras || [];

  // Apply filters
  if (filters.value.rutProveedor) {
    compras = compras.filter(compra =>
      compra.rutProveedor.toLowerCase().includes(filters.value.rutProveedor.toLowerCase())
    );
  }

  if (filters.value.razonSocial) {
    compras = compras.filter(compra =>
      compra.razonSocial.toLowerCase().includes(filters.value.razonSocial.toLowerCase())
    );
  }

  if (filters.value.tipoDte) {
    compras = compras.filter(compra => compra.tipoDTE.toString() === filters.value.tipoDte);
  }

  if (filters.value.estado) {
    compras = compras.filter(compra => compra.estado === filters.value.estado);
  }

  if (filters.value.fechaDesde) {
    compras = compras.filter(compra =>
      new Date(compra.fechaEmision) >= new Date(filters.value.fechaDesde)
    );
  }

  if (filters.value.fechaHasta) {
    compras = compras.filter(compra =>
      new Date(compra.fechaEmision) <= new Date(filters.value.fechaHasta)
    );
  }

  if (filters.value.montoMinimo) {
    const minimo = parseFloat(filters.value.montoMinimo);
    compras = compras.filter(compra => compra.montoTotal >= minimo);
  }

  if (filters.value.montoMaximo) {
    const maximo = parseFloat(filters.value.montoMaximo);
    compras = compras.filter(compra => compra.montoTotal <= maximo);
  }

  // Apply sorting
  return compras.sort((a, b) => {
    const aValue = a[sortConfig.value.field];
    const bValue = b[sortConfig.value.field];

    let comparison = 0;
    if (aValue != null && bValue != null) {
      if (aValue > bValue) comparison = 1;
      if (aValue < bValue) comparison = -1;
    }

    return sortConfig.value.direction === 'desc' ? -comparison : comparison;
  });
});

const detalleCompras = computed((): DetalleCompra[] => filteredDetalleCompras.value);

// Get unique values for filter dropdowns
const uniqueTiposDte = computed(() => {
  const compras = formsStore.data?.compras.detalleCompras || [];
  const tipos = [...new Set(compras.map(c => ({ value: c.tipoDTE.toString(), label: c.tipoDTEString })))];
  return tipos.sort((a, b) => parseInt(a.value) - parseInt(b.value));
});

const uniqueEstados = computed(() => {
  const compras = formsStore.data?.compras.detalleCompras || [];
  return [...new Set(compras.map(c => c.estado))];
});

// Utility functions
const clearFilters = () => {
  filters.value = {
    rutProveedor: '',
    razonSocial: '',
    tipoDte: '',
    estado: '',
    fechaDesde: '',
    fechaHasta: '',
    montoMinimo: '',
    montoMaximo: ''
  };
};

const sortBy = (field: keyof DetalleCompra) => {
  if (sortConfig.value.field === field) {
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortConfig.value.field = field;
    sortConfig.value.direction = 'asc';
  }
};

const getSortIcon = (field: keyof DetalleCompra) => {
  if (sortConfig.value.field !== field) return '↕️';
  return sortConfig.value.direction === 'asc' ? '↑' : '↓';
};

// Calculate totals based on filtered data
const totales = computed(() => {
  const compras = detalleCompras.value;
  return {
    totalDocumentos: compras.length,
    montoTotal: compras.reduce((sum, compra) => sum + compra.montoTotal, 0),
    montoNeto: compras.reduce((sum, compra) => sum + compra.montoNeto, 0),
    ivaTotal: compras.reduce((sum, compra) => sum + compra.montoIvaRecuperable, 0)
  };
});

const refreshData = async () => {
  try {
    // Load reference data if not already loaded
    if (formsStore.tiposDte.length === 0) {
      await formsStore.loadTiposDte();
    }
    if (formsStore.proveedores.length === 0) {
      await formsStore.loadProveedores();
    }

    await formsStore.getAll();
  } catch (error) {
    console.error('Error refreshing data:', error);
  }
};
</script>

<template>
  <div class="consultas-view">
    <!-- Header -->
    <div class="header">
      <h1>Consultas SII - Libro de Compras</h1>
      <button
        @click="refreshData"
        :disabled="formsStore.loading"
        class="refresh-btn"
      >
        {{ formsStore.loading ? 'Cargando...' : 'Actualizar' }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="formsStore.loading" class="loading">
      <p>Cargando datos...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="formsStore.error" class="error">
      <p>Error: {{ formsStore.error }}</p>
      <button @click="refreshData" class="retry-btn">Reintentar</button>
    </div>

    <!-- Data Display -->
    <div v-else-if="formsStore.data" class="data-container">
      <!-- Caratula Information -->
      <div class="caratula-card">
        <h2>Información del Período</h2>
        <div class="caratula-info">
          <div class="info-item">
            <span class="label">RUT Empresa:</span>
            <span class="value">{{ caratula?.rutEmpresa }}</span>
          </div>
          <div class="info-item">
            <span class="label">Período:</span>
            <span class="value">{{ caratula?.nombreMes }} {{ caratula?.anio }}</span>
          </div>
          <div class="info-item">
            <span class="label">Código Período:</span>
            <span class="value">{{ caratula?.periodo }}</span>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-section">
        <h2>Resumen por Tipo de Documento</h2>
        <div class="summary-cards">
          <div v-for="resumen in resumenes" :key="resumen.tipoDte" class="summary-card">
            <h3>{{ resumen.tipoDteString }}</h3>
            <div class="summary-stats">
              <div class="stat">
                <span class="stat-label">Documentos:</span>
                <span class="stat-value">{{ resumen.totalDocumentos }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Monto Total:</span>
                <span class="stat-value">{{ formatCurrency(resumen.montoTotal) }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Estado:</span>
                <span class="stat-value" :class="`estado-${resumen.estado.toLowerCase()}`">
                  {{ resumen.estado }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Totals Card -->
      <div class="totals-card">
        <h2>Totales Generales</h2>
        <div class="totals-info">
          <div class="total-item">
            <span class="label">Total Documentos:</span>
            <span class="value">{{ totales.totalDocumentos }}</span>
          </div>
          <div class="total-item">
            <span class="label">Monto Neto:</span>
            <span class="value">{{ formatCurrency(totales.montoNeto) }}</span>
          </div>
          <div class="total-item">
            <span class="label">IVA Recuperable:</span>
            <span class="value">{{ formatCurrency(totales.ivaTotal) }}</span>
          </div>
          <div class="total-item">
            <span class="label">Monto Total:</span>
            <span class="value total-amount">{{ formatCurrency(totales.montoTotal) }}</span>
          </div>
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="table-section">
        <div class="table-header">
          <h2>Detalle de Compras</h2>
          <div class="table-controls">
            <button @click="showFilters = !showFilters" class="filter-toggle-btn">
              {{ showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros' }}
            </button>
            <span class="results-count">{{ detalleCompras.length }} resultados</span>
          </div>
        </div>

        <!-- Filters Panel -->
        <div v-if="showFilters" class="filters-panel">
          <div class="filters-grid">
            <div class="filter-group">
              <label>RUT Proveedor:</label>
              <input
                v-model="filters.rutProveedor"
                type="text"
                placeholder="Buscar por RUT..."
                class="filter-input"
              />
            </div>

            <div class="filter-group">
              <label>Razón Social:</label>
              <input
                v-model="filters.razonSocial"
                type="text"
                placeholder="Buscar por razón social..."
                class="filter-input"
              />
            </div>

            <div class="filter-group">
              <label>Tipo DTE:</label>
              <select v-model="filters.tipoDte" class="filter-select">
                <option value="">Todos los tipos</option>
                <option v-for="tipo in uniqueTiposDte" :key="tipo.value" :value="tipo.value">
                  {{ tipo.value }} - {{ tipo.label }}
                </option>
              </select>
            </div>

            <div class="filter-group">
              <label>Estado:</label>
              <select v-model="filters.estado" class="filter-select">
                <option value="">Todos los estados</option>
                <option v-for="estado in uniqueEstados" :key="estado" :value="estado">
                  {{ estado }}
                </option>
              </select>
            </div>

            <div class="filter-group">
              <label>Fecha Desde:</label>
              <input
                v-model="filters.fechaDesde"
                type="date"
                class="filter-input"
              />
            </div>

            <div class="filter-group">
              <label>Fecha Hasta:</label>
              <input
                v-model="filters.fechaHasta"
                type="date"
                class="filter-input"
              />
            </div>

            <div class="filter-group">
              <label>Monto Mínimo:</label>
              <input
                v-model="filters.montoMinimo"
                type="number"
                placeholder="0"
                class="filter-input"
              />
            </div>

            <div class="filter-group">
              <label>Monto Máximo:</label>
              <input
                v-model="filters.montoMaximo"
                type="number"
                placeholder="Sin límite"
                class="filter-input"
              />
            </div>
          </div>

          <div class="filter-actions">
            <button @click="clearFilters" class="clear-filters-btn">
              Limpiar Filtros
            </button>
          </div>
        </div>

        <div class="table-container">
          <table class="compras-table">
            <thead>
              <tr>
                <th @click="sortBy('tipoDTEString')" class="sortable">
                  Tipo DTE {{ getSortIcon('tipoDTEString') }}
                </th>
                <th @click="sortBy('rutProveedor')" class="sortable">
                  RUT Proveedor {{ getSortIcon('rutProveedor') }}
                </th>
                <th @click="sortBy('razonSocial')" class="sortable">
                  Razón Social {{ getSortIcon('razonSocial') }}
                </th>
                <th @click="sortBy('folio')" class="sortable">
                  Folio {{ getSortIcon('folio') }}
                </th>
                <th @click="sortBy('fechaEmision')" class="sortable">
                  Fecha Emisión {{ getSortIcon('fechaEmision') }}
                </th>
                <th @click="sortBy('montoNeto')" class="sortable">
                  Monto Neto {{ getSortIcon('montoNeto') }}
                </th>
                <th @click="sortBy('montoIvaRecuperable')" class="sortable">
                  IVA {{ getSortIcon('montoIvaRecuperable') }}
                </th>
                <th @click="sortBy('montoTotal')" class="sortable">
                  Monto Total {{ getSortIcon('montoTotal') }}
                </th>
                <th @click="sortBy('estado')" class="sortable">
                  Estado {{ getSortIcon('estado') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="compra in detalleCompras" :key="`${compra.rutProveedor}-${compra.folio}`">
                <td>{{ compra.tipoDTEString }}</td>
                <td>{{ compra.rutProveedor }}</td>
                <td class="razon-social">{{ compra.razonSocial }}</td>
                <td>{{ compra.folio.toLocaleString() }}</td>
                <td>{{ formatDate(compra.fechaEmision) }}</td>
                <td class="amount">{{ formatCurrency(compra.montoNeto) }}</td>
                <td class="amount">{{ formatCurrency(compra.montoIvaRecuperable) }}</td>
                <td class="amount total">{{ formatCurrency(compra.montoTotal) }}</td>
                <td>
                  <span class="estado-badge" :class="`estado-${compra.estado.toLowerCase()}`">
                    {{ compra.estado }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p>No hay datos disponibles</p>
      <button @click="refreshData" class="load-btn">Cargar Datos</button>
    </div>
  </div>
</template>

<style scoped>
.consultas-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  color: #2c3e50;
  margin: 0;
}

.refresh-btn, .retry-btn, .load-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s ease;
}

.refresh-btn:hover, .retry-btn:hover, .load-btn:hover {
  background: #2980b9;
}

.refresh-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.loading, .error, .empty-state {
  text-align: center;
  padding: 3rem;
  background: #f8f9fa;
  border-radius: 12px;
  margin: 2rem 0;
}

.error {
  background: #fff5f5;
  color: #e53e3e;
}

.caratula-card, .totals-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.caratula-info, .totals-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-item, .total-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.label {
  font-weight: 600;
  color: #555;
}

.value {
  color: #2c3e50;
  font-weight: 500;
}

.total-amount {
  font-size: 1.2em;
  font-weight: 700;
  color: #27ae60;
}

.summary-section {
  margin-bottom: 2rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.summary-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #3498db;
}

.summary-card h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.1em;
}

.summary-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat {
  display: flex;
  justify-content: space-between;
}

.stat-label {
  color: #666;
  font-size: 0.9em;
}

.stat-value {
  font-weight: 600;
  color: #2c3e50;
}

.table-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.filter-toggle-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
}

.filter-toggle-btn:hover {
  background: #5a6268;
}

.results-count {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.filters-panel {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group label {
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
}

.filter-input, .filter-select {
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.3s ease;
}

.filter-input:focus, .filter-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
}

.clear-filters-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
}

.clear-filters-btn:hover {
  background: #c82333;
}

.table-container {
  overflow-x: auto;
  margin-top: 1rem;
}

.compras-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.compras-table th {
  background: #f8f9fa;
  padding: 1rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
}

.compras-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.compras-table th.sortable:hover {
  background: #e9ecef;
}

.compras-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}

.compras-table tr:hover {
  background: #f8f9fa;
}

.razon-social {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  text-align: right;
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

.amount.total {
  font-weight: 700;
  color: #27ae60;
}

.estado-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
}

.estado-confirmada {
  background: #d4edda;
  color: #155724;
}

.estado-pendiente {
  background: #fff3cd;
  color: #856404;
}

h2 {
  color: #2c3e50;
  margin: 0 0 1rem 0;
  font-size: 1.5em;
}

@media (max-width: 768px) {
  .consultas-view {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .caratula-info, .totals-info {
    grid-template-columns: 1fr;
  }

  .summary-cards {
    grid-template-columns: 1fr;
  }

  .table-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .table-controls {
    justify-content: space-between;
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: center;
  }

  .compras-table {
    font-size: 0.8em;
  }

  .compras-table th,
  .compras-table td {
    padding: 0.5rem 0.25rem;
  }
}
</style>
