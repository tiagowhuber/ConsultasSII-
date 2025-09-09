<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useFormsStore } from '@/stores/forms';
import type { DetalleCompra, ResumenCompra } from '@/types/api';

const formsStore = useFormsStore();

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
    await formsStore.getAll();
  } catch (error) {
    console.error('Error loading data:', error);
  }
});

// Computed properties
const caratula = computed(() => formsStore.data?.caratula);
const resumenes = computed(() => formsStore.data?.compras.resumenes || []);
const detalleCompras = computed(() => formsStore.data?.compras.detalleCompras || []);

// Calculate totals
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
        <h2>Detalle de Compras</h2>
        <div class="table-container">
          <table class="compras-table">
            <thead>
              <tr>
                <th>Tipo DTE</th>
                <th>RUT Proveedor</th>
                <th>Razón Social</th>
                <th>Folio</th>
                <th>Fecha Emisión</th>
                <th>Monto Neto</th>
                <th>IVA</th>
                <th>Monto Total</th>
                <th>Estado</th>
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
  
  .compras-table {
    font-size: 0.8em;
  }
  
  .compras-table th,
  .compras-table td {
    padding: 0.5rem 0.25rem;
  }
}
</style>