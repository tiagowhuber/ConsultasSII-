<script setup lang="ts">
import { onMounted, computed, ref, onUnmounted } from 'vue';
import { useFormsStore } from '@/stores/dte';
import { useNotasStore } from '@/stores/notas';
import { useSiiStore } from '@/stores/sii';
import NotificationBell from '@/components/NotificationBell.vue';
import type { DetalleCompra, ResumenCompra } from '@/types/api';
import * as XLSX from 'xlsx';
import { siiApi } from '@/services/api';

const formsStore = useFormsStore();
const notasStore = useNotasStore();
const siiStore = useSiiStore();

// Filter and sorting state
const globalSearch = ref('');

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
const showColumnControls = ref(false);

// Column visibility state
const columnVisibility = ref({
  tipoDTE: true,
  rutProveedor: true,
  razonSocial: true,
  folio: true,
  fechaEmision: true,
  fechaRecepcion: true,
  montoNeto: true,// Hidden by default
  montoIva: true, // Hidden by default
  montoTotal: true,
  estado: true,
  contabilizado: true,
  pagado: true,
  comentario: true,
  descargar: false
});

// Comment editing state
const editingComment = ref<string | null>(null);
const editingCommentText = ref('');

// Table scroll state
const tableContainer = ref<HTMLElement | null>(null);

// Server wake-up state
const isWakingUp = ref(false);
const serverIsWarm = ref(false);
const lastWakeupTime = ref<Date | null>(null);
const showWakeupButton = ref(false);

// API call counter state
const apiCallCount = ref<number | null>(null);
const lastCalledAt = ref<string | null>(null);

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

// Fetch API call counter
const fetchCallCount = async () => {
  try {
    const response = await siiApi.getCallCount();
    console.log('API call count fetched:', response.data);
    apiCallCount.value = response.data.fetchSIIDataCount;
    if (response.data.allCounters.length > 0) {
      const fetchCounter = response.data.allCounters.find(c => c.functionName === 'fetchSIIData');
      if (fetchCounter) {
        lastCalledAt.value = fetchCounter.lastCalledAt;
      }
    }
  } catch (error) {
    console.error('Error fetching call count:', error);
    // Don't set to null, keep last known value
  }
};

// Auto-refresh counter every 30 seconds
let counterInterval: number | null = null;

// Load data on component mount
onMounted(async () => {
  try {
    // Check if server is already warm on initial load
    await wakeUpServer(false); // Silent check, no user feedback

    // Wait 7 seconds before showing the wake-up button if server is not warm
    setTimeout(() => {
      if (!serverIsWarm.value || needsWakeup.value) {
        showWakeupButton.value = true;
      }
    }, 7000);

    // Try to load some reference data first
    await Promise.allSettled([
      formsStore.loadTiposDte(),
      formsStore.loadProveedores()
    ]);

    // Load main data using current month and year from store
    await formsStore.refreshWithCurrentDate();

    // Fetch initial call count
    await fetchCallCount();

    // Set up auto-refresh for call count
    counterInterval = window.setInterval(() => {
      fetchCallCount();
    }, 30000); // Refresh every 30 seconds
  } catch (error) {
    console.error('Error loading data:', error);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (counterInterval !== null) {
    clearInterval(counterInterval);
  }
});// Computed properties
const caratula = computed(() => formsStore.data?.caratula);
const resumenes = computed((): ResumenCompra[] => formsStore.data?.compras.resumenes || []);

// Filtered and sorted detalle compras
const filteredDetalleCompras = computed((): DetalleCompra[] => {
  let compras = formsStore.data?.compras.detalleCompras || [];

  // Apply global search first
  if (globalSearch.value.trim()) {
    const searchTerm = globalSearch.value.toLowerCase().trim();
    compras = compras.filter(compra => {
      // Search across all relevant fields
      const searchableText = [
        compra.tipoDTEString,
        compra.rutProveedor,
        compra.razonSocial,
        compra.folio.toString(),
        formatDate(compra.fechaEmision),
        formatDate(compra.fechaRecepcion),
        formatCurrency(compra.montoNeto),
        formatCurrency(compra.montoIvaRecuperable),
        formatCurrency(compra.montoTotal),
        compra.estado,
        compra.comentario || ''
      ].join(' ').toLowerCase();

      return searchableText.includes(searchTerm);
    });
  }

  // Apply specific filters
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
  globalSearch.value = '';
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

// Column visibility functions
const toggleColumn = (column: keyof typeof columnVisibility.value) => {
  columnVisibility.value[column] = !columnVisibility.value[column];
};

if(toggleColumn == undefined){
  console.log(toggleColumn)
}

const resetColumns = () => {
  columnVisibility.value = {
    tipoDTE: true,
    rutProveedor: true,
    razonSocial: true,
    folio: true,
    fechaEmision: true,
    fechaRecepcion: true,
    montoNeto: true,
    montoIva: true,
    montoTotal: true,
    estado: true,
    contabilizado: true,
    pagado: true,
    comentario: true,
    descargar: false
  };
};

const showEssentialColumns = () => {
  columnVisibility.value = {
    tipoDTE: true,
    rutProveedor: false,
    razonSocial: true,
    folio: true,
    fechaEmision: true,
    fechaRecepcion: true,
    montoNeto: false,
    montoIva: false,
    montoTotal: true,
    estado: true,
    contabilizado: true,
    pagado: true,
    comentario: false,
    descargar: false
  };
};

const showAllColumns = () => {
  Object.keys(columnVisibility.value).forEach(key => {
    columnVisibility.value[key as keyof typeof columnVisibility.value] = true;
  });
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

// Wake up server function
const wakeUpServer = async (showFeedback = true) => {
  if (isWakingUp.value) return;

  try {
    isWakingUp.value = true;

    // Make a health check request to wake up the server
    const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const response = await fetch(`${baseURL}/api/scheduler/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      serverIsWarm.value = true;
      lastWakeupTime.value = new Date();
      showWakeupButton.value = false; // Hide button when server is warm
      if (showFeedback) {
        console.log('Server is now awake!', data);
      }
    } else {
      throw new Error(`Health check failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Error waking up server:', error);
    // Don't show error for auto wake-ups, only manual ones
    if (showFeedback) {
      // You could add a toast notification here
      alert('Failed to wake up server. It may take a moment to respond.');
    }
  } finally {
    isWakingUp.value = false;
  }
};

// Check if server needs warming (if it's been more than 15 minutes since last activity)
const needsWakeup = computed(() => {
  if (!lastWakeupTime.value) return true;
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return lastWakeupTime.value < fifteenMinutesAgo;
});

const fetchSiiData = async () => {
  try {
    siiStore.clearError();

    // Auto wake-up server if needed before making the SII request
    if (needsWakeup.value) {
      await wakeUpServer(false); // Don't show feedback for auto wake-up
      // Give server a moment to fully wake up
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const year = formsStore.currentYear;
    const month = formsStore.currentMonth;

    await siiStore.fetchAndStore(year, month);

    // After successful SII fetch, refresh the local data
    await refreshData();

    // Refresh the call counter after successful fetch
    await fetchCallCount();
  } catch (error) {
    console.error('Error fetching SII data:', error);
    // Error is already handled in the store
  }
};

const refreshData = async () => {
  try {
    // Auto wake-up server if needed before making requests
    if (needsWakeup.value) {
      await wakeUpServer(false); // Don't show feedback for auto wake-up
      // Give server a moment to fully wake up
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Load reference data if not already loaded
    if (formsStore.tiposDte.length === 0) {
      await formsStore.loadTiposDte();
    }
    if (formsStore.proveedores.length === 0) {
      await formsStore.loadProveedores();
    }

    await formsStore.refreshWithCurrentDate();
  } catch (error) {
    console.error('Error refreshing data:', error);
  }
};

// Date selection handlers
const onMonthChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  formsStore.setMonth(target.value);
  await refreshData();
};

const onYearChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  formsStore.setYear(target.value);
  await refreshData();
};

// Table scroll methods
const handleTableScroll = () => {
  // Keep this for potential future use
};

const scrollTableLeft = () => {
  if (!tableContainer.value) return;
  tableContainer.value.scrollBy({ left: -200, behavior: 'smooth' });
};

const scrollTableRight = () => {
  if (!tableContainer.value) return;
  tableContainer.value.scrollBy({ left: 200, behavior: 'smooth' });
};

const scrollTableToStart = () => {
  if (!tableContainer.value) return;
  tableContainer.value.scrollTo({ left: 0, behavior: 'smooth' });
};

const scrollTableToEnd = () => {
  if (!tableContainer.value) return;
  tableContainer.value.scrollTo({ left: tableContainer.value.scrollWidth, behavior: 'smooth' });
};

// Download function to open SII document link
const downloadDocument = (compra: DetalleCompra) => {
  // Build SII URL with document parameters for future enhancement
  const siiUrl = 'https://www1.sii.cl/cgi-bin/Portal001/mipeGesDocEmi.cgi?';

  // Log the document details for debugging (can be removed in production)
  console.log('Downloading document for:', {
    rut: compra.rutProveedor,
    folio: compra.folio,
    tipo: compra.tipoDTE
  });

  window.open(siiUrl, '_blank');
};

// Comment editing functions
const startEditComment = (compra: DetalleCompra) => {
  const key = `${compra.rutProveedor}-${compra.folio}`;
  editingComment.value = key;
  editingCommentText.value = compra.comentario || '';
};

const cancelEditComment = () => {
  editingComment.value = null;
  editingCommentText.value = '';
};

// Toggle contabilizado status
const toggleContabilizado = async (compra: DetalleCompra) => {
  try {
    const currentStatus = compra.contabilizado || false;
    const newContabilizadoStatus = !currentStatus;

    // Call the notas store method with folio
    await notasStore.updateContabilizado(
      compra.folio.toString(),
      newContabilizadoStatus
    );

    // Update local state
    compra.contabilizado = newContabilizadoStatus;

    console.log(`Contabilizado status updated for folio ${compra.folio}: ${newContabilizadoStatus}`);
  } catch (error) {
    console.error('Error updating contabilizado status:', error);
    // You could add a toast notification here
  }
};

// Toggle pagado status
const togglePagado = async (compra: DetalleCompra) => {
  try {
    const currentStatus = compra.pagado || false;
    const newPagadoStatus = !currentStatus;

    // Call the notas store method with folio
    await notasStore.updatePagado(
      compra.folio.toString(),
      newPagadoStatus
    );

    // Update local state
    compra.pagado = newPagadoStatus;

    console.log(`Pagado status updated for folio ${compra.folio}: ${newPagadoStatus}`);
  } catch (error) {
    console.error('Error updating pagado status:', error);
    // You could add a toast notification here
  }
};

const saveComment = async (compra: DetalleCompra, event?: Event) => {
  if (editingComment.value === null) return;

  // Prevent default behavior and stop propagation to avoid page scrolling
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  try {
    // Call the notas store method with folio
    await notasStore.updateComment(
      compra.folio.toString(),
      editingCommentText.value
    );

    // Update local state
    compra.comentario = editingCommentText.value;

    editingComment.value = null;
    editingCommentText.value = '';
  } catch (error) {
    console.error('Error updating comment:', error);
    // You could add a toast notification here
  }
};

// Excel export function
const exportToExcel = () => {
  try {
    // Prepare data for export
    const exportData = detalleCompras.value.map(compra => ({
      'Tipo DTE': compra.tipoDTEString,
      'RUT Proveedor': compra.rutProveedor,
      'Razón Social': compra.razonSocial,
      'Folio': compra.folio,
      'Fecha Emisión': formatDate(compra.fechaEmision),
      'Fecha Recepción': formatDate(compra.fechaRecepcion),
      'Monto Neto': compra.montoNeto,
      'IVA Recuperable': compra.montoIvaRecuperable,
      'Monto Total': compra.montoTotal,
      'Estado': compra.estado,
      'Contabilizado': compra.contabilizado ? 'Sí' : 'No',
      'Pagado': compra.pagado ? 'Sí' : 'No',
      'Comentario': compra.comentario || ''
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const colWidths = [
      { width: 12 }, // Tipo DTE
      { width: 15 }, // RUT Proveedor
      { width: 30 }, // Razón Social
      { width: 12 }, // Folio
      { width: 15 }, // Fecha Emisión
      { width: 15 }, // Fecha Recepción
      { width: 15 }, // Monto Neto
      { width: 15 }, // IVA Recuperable
      { width: 15 }, // Monto Total
      { width: 12 }, // Estado
      { width: 12 }, // Contabilizado
      { width: 10 }, // Pagado
      { width: 30 }  // Comentario
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Compras');

    // Generate filename with current date and period
    const period = `${caratula.value?.nombreMes || formsStore.currentMonth}-${caratula.value?.anio || formsStore.currentYear}`;
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `Libro_Compras_${period}_${currentDate}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);

    console.log(`Excel file exported: ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    // You could add a toast notification here
  }
};
</script>

<template>
  <div class="consultas-view">
    <!-- Header -->
    <div class="header">
      <h1>Consultas SII - Libro de Compras</h1>
      <div class="header-controls">
        <div class="date-selectors">
          <div class="selector-group">
            <label for="month-select">Mes:</label>
            <select
              id="month-select"
              :value="formsStore.currentMonth"
              @change="onMonthChange"
              class="date-select"
            >
              <option value="01">Enero</option>
              <option value="02">Febrero</option>
              <option value="03">Marzo</option>
              <option value="04">Abril</option>
              <option value="05">Mayo</option>
              <option value="06">Junio</option>
              <option value="07">Julio</option>
              <option value="08">Agosto</option>
              <option value="09">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
          </div>
          <div class="selector-group">
            <label for="year-select">Año:</label>
            <select
              id="year-select"
              :value="formsStore.currentYear"
              @change="onYearChange"
              class="date-select"
            >
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>

        <!-- Add notification bell -->
        <NotificationBell />

        <!-- Wake up server button -->
        <button
          v-if="showWakeupButton && !(serverIsWarm && !needsWakeup)"
          @click="wakeUpServer(true)"
          :disabled="isWakingUp"
          class="refresh-btn wake-up-btn"
          :class="{ 'server-warm': serverIsWarm && !needsWakeup }"
          :title="serverIsWarm && !needsWakeup ? 'Servidor activo' : 'Despertar servidor (recomendado antes de obtener datos del SII)'"
        >
          {{ isWakingUp ? '🔄 Despertando servidor...' : (serverIsWarm && !needsWakeup) ? '✅ Servidor activo' : '☕ Despertar servidor' }}
        </button>

        <button
          @click="fetchSiiData"
          :disabled="siiStore.loading || formsStore.loading"
          class="refresh-btn sii-fetch-btn"
        >
          {{ siiStore.loading ? '🔄 Obteniendo datos del SII... (puede tomar 30s)' : formsStore.loading ? 'Cargando...' : '📥 Obtener datos del SII' }}
        </button>

        <!-- API Call Counter (minimalistic) -->
        <div v-if="apiCallCount !== null" class="api-counter" title="Llamadas realizadas a la API del SII este mes">
          <span class="counter-text">{{ apiCallCount }}/30</span>
        </div>

        <!-- <button
          @click="refreshData"
          :disabled="formsStore.loading"
          class="refresh-btn secondary-btn"
        >
          {{ formsStore.loading ? 'Cargando...' : 'Actualizar vista' }}
        </button> -->
      </div>
    </div>

    <!-- SII Loading State -->
    <div v-if="siiStore.loading" class="sii-loading-overlay">
      <div class="sii-loading-content">
        <div class="sii-loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-inner"></div>
        </div>
        <h3>Obteniendo datos del SII</h3>
        <p class="loading-message">Conectando con el Servicio de Impuestos Internos...</p>
        <p class="loading-submessage">Este proceso puede tomar hasta 30 segundos</p>
        <div class="loading-progress">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <span class="progress-text">Procesando solicitud...</span>
        </div>
        <div class="server-status" v-if="needsWakeup">
          <div class="status-indicator warming">
            <span class="status-dot"></span>
            <span class="status-text">Despertando servidor...</span>
          </div>
        </div>
        <div class="loading-tips">
          <ul>
            <li>Se están descargando los documentos del período seleccionado</li>
            <li>No es necesario mantener esta ventana abierta</li>
            <li v-if="needsWakeup">El servidor se está despertando automáticamente</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="formsStore.loading" class="loading">
      <p>Cargando datos...</p>
    </div>

    <!-- SII Error State -->
    <div v-if="siiStore.error" class="error sii-error">
      <p>Error SII: {{ siiStore.error }}</p>
      <button @click="fetchSiiData" class="retry-btn">Reintentar obtención de SII</button>
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
        <!-- Global Search Bar -->
        <div class="global-search-section">
          <div class="search-container">
            <div class="search-input-wrapper">
              <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="21 21l-4.35-4.35"/>
              </svg>
              <input
                v-model="globalSearch"
                type="text"
                placeholder="Buscar"
                class="global-search-input"
              />
              <button
                v-if="globalSearch"
                @click="globalSearch = ''"
                class="clear-search-btn"
                title="Limpiar búsqueda"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="search-results-info">
              <span v-if="globalSearch" class="search-results-text">
                {{ detalleCompras.length }} resultado{{ detalleCompras.length !== 1 ? 's' : '' }} para "{{ globalSearch }}"
              </span>
            </div>
          </div>
        </div>

        <div class="table-header">
          <h2>Detalle de Compras</h2>
          <div class="table-controls">
            <button @click="exportToExcel" class="excel-export-btn">
              📊 Exportar a Excel
            </button>
            <button @click="showColumnControls = !showColumnControls" class="column-toggle-btn">
              {{ showColumnControls ? 'Opciones de Columnas' : 'Opciones de Columnas' }}
            </button>
            <button @click="showFilters = !showFilters" class="filter-toggle-btn">
              {{ showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros' }}
            </button>
            <span class="results-count">{{ detalleCompras.length }} resultados</span>
          </div>
        </div>

        <!-- Column Controls Panel -->
        <div v-if="showColumnControls" class="column-controls-panel">
          <div class="column-presets">
            <button @click="showEssentialColumns" class="preset-btn essential">Esencial</button>
            <button @click="resetColumns" class="preset-btn default">Por Defecto</button>
            <button @click="showAllColumns" class="preset-btn all">Todas</button>
          </div>
          <div class="column-toggles">
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.tipoDTE" />
              <span>Tipo DTE</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.rutProveedor" />
              <span>RUT Proveedor</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.razonSocial" />
              <span>Razón Social</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.folio" />
              <span>Folio</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.fechaEmision" />
              <span>Fecha Emisión</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.fechaRecepcion" />
              <span>Fecha Recepción</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.montoNeto" />
              <span>Monto Neto</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.montoIva" />
              <span>IVA</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.montoTotal" />
              <span>Monto Total</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.estado" />
              <span>Estado</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.contabilizado" />
              <span>Contabilizado</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.pagado" />
              <span>Pagado</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.comentario" />
              <span>Comentario</span>
            </label>
            <label class="column-toggle">
              <input type="checkbox" v-model="columnVisibility.descargar" />
              <span>Descargar</span>
            </label>
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

        <!-- Horizontal Scroll Controls -->
        <div class="table-scroll-controls">
          <div class="scroll-info">
            <span class="scroll-label">Desplazamiento horizontal:</span>
            <div class="scroll-buttons">
              <button @click="scrollTableLeft" class="scroll-btn" title="Desplazar a la izquierda">
                ←
              </button>
              <button @click="scrollTableRight" class="scroll-btn" title="Desplazar a la derecha">
                →
              </button>
              <button @click="scrollTableToStart" class="scroll-btn" title="Ir al inicio">
                ⇤
              </button>
              <button @click="scrollTableToEnd" class="scroll-btn" title="Ir al final">
                ⇥
              </button>
            </div>
          </div>
        </div>

        <div class="table-container" ref="tableContainer" @scroll="handleTableScroll">
          <table class="compras-table">
            <thead>
              <tr>
                <th v-if="columnVisibility.tipoDTE" @click="sortBy('tipoDTEString')" class="sortable">
                  Tipo DTE {{ getSortIcon('tipoDTEString') }}
                </th>
                <th v-if="columnVisibility.rutProveedor" @click="sortBy('rutProveedor')" class="sortable">
                  RUT Proveedor {{ getSortIcon('rutProveedor') }}
                </th>
                <th v-if="columnVisibility.razonSocial" @click="sortBy('razonSocial')" class="sortable">
                  Razón Social {{ getSortIcon('razonSocial') }}
                </th>
                <th v-if="columnVisibility.folio" @click="sortBy('folio')" class="sortable">
                  Folio {{ getSortIcon('folio') }}
                </th>
                <th v-if="columnVisibility.fechaEmision" @click="sortBy('fechaEmision')" class="sortable">
                  Fecha Emisión {{ getSortIcon('fechaEmision') }}
                </th>
                <th v-if="columnVisibility.fechaRecepcion" @click="sortBy('fechaRecepcion')" class="sortable">
                  Fecha Recepción {{ getSortIcon('fechaRecepcion') }}
                </th>
                <th v-if="columnVisibility.montoNeto" @click="sortBy('montoNeto')" class="sortable">
                  Monto Neto {{ getSortIcon('montoNeto') }}
                </th>
                <th v-if="columnVisibility.montoIva" @click="sortBy('montoIvaRecuperable')" class="sortable">
                  IVA {{ getSortIcon('montoIvaRecuperable') }}
                </th>
                <th v-if="columnVisibility.montoTotal" @click="sortBy('montoTotal')" class="sortable">
                  Monto Total {{ getSortIcon('montoTotal') }}
                </th>
                <th v-if="columnVisibility.estado" @click="sortBy('estado')" class="sortable">
                  Estado {{ getSortIcon('estado') }}
                </th>
                <th v-if="columnVisibility.contabilizado">Contabilizado</th>
                <th v-if="columnVisibility.pagado">Pagado</th>
                <th v-if="columnVisibility.comentario">Comentario</th>
                <th v-if="columnVisibility.descargar">Descargar</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="compra in detalleCompras" :key="`${compra.rutProveedor}-${compra.folio}`">
                <td v-if="columnVisibility.tipoDTE">{{ compra.tipoDTEString }}</td>
                <td v-if="columnVisibility.rutProveedor">{{ compra.rutProveedor }}</td>
                <td v-if="columnVisibility.razonSocial" class="razon-social" :title="compra.razonSocial">{{ compra.razonSocial }}</td>
                <td v-if="columnVisibility.folio">{{ compra.folio }}</td>
                <td v-if="columnVisibility.fechaEmision">{{ formatDate(compra.fechaEmision) }}</td>
                <td v-if="columnVisibility.fechaRecepcion">{{ formatDate(compra.fechaRecepcion) }}</td>
                <td v-if="columnVisibility.montoNeto" class="amount">{{ formatCurrency(compra.montoNeto) }}</td>
                <td v-if="columnVisibility.montoIva" class="amount">{{ formatCurrency(compra.montoIvaRecuperable) }}</td>
                <td v-if="columnVisibility.montoTotal" class="amount total">{{ formatCurrency(compra.montoTotal) }}</td>
                <td v-if="columnVisibility.estado">
                  <span class="estado-badge" :class="`estado-${compra.estado.toLowerCase()}`">
                    {{ compra.estado }}
                  </span>
                </td>
                <td v-if="columnVisibility.contabilizado" class="contabilizado-cell">
                  <label class="checkbox-wrapper">
                    <input
                      type="checkbox"
                      :checked="compra.contabilizado || false"
                      @change="toggleContabilizado(compra)"
                      class="contabilizado-checkbox"
                    />
                    <span class="checkmark"></span>
                  </label>
                </td>
                <td v-if="columnVisibility.pagado" class="pagado-cell">
                  <label class="checkbox-wrapper">
                    <input
                      type="checkbox"
                      :checked="compra.pagado || false"
                      @change="togglePagado(compra)"
                      class="pagado-checkbox"
                    />
                    <span class="checkmark"></span>
                  </label>
                </td>
                <td v-if="columnVisibility.comentario" class="comment-cell">
                  <div class="comment-wrapper">
                    <input
                      v-if="editingComment === `${compra.rutProveedor}-${compra.folio}`"
                      v-model="editingCommentText"
                      @keyup.enter="(event) => saveComment(compra, event)"
                      @keyup.escape="cancelEditComment"
                      @blur="(event) => saveComment(compra, event)"
                      class="comment-input"
                      placeholder="Agregar comentario..."
                      ref="commentInput"
                    />
                    <div
                      v-else
                      @click="startEditComment(compra)"
                      class="comment-display"
                      :class="{ 'empty-comment': !compra.comentario }"
                    >
                      {{ compra.comentario || 'Click para agregar comentario' }}
                    </div>
                  </div>
                </td>
                <td v-if="columnVisibility.descargar">
                  <button
                    @click="downloadDocument(compra)"
                    class="download-btn"
                    title="Descargar documento desde SII"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
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
  max-width: 95%;
  width: 95%;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header h1 {
  color: #2c3e50;
  margin: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

/* API Call Counter Styles - Minimalistic */
.api-counter {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  cursor: help;
}

.api-counter:hover {
  border-color: #3498db;
  box-shadow: 0 2px 6px rgba(52, 152, 219, 0.2);
}

.counter-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  letter-spacing: 0.3px;
}

.date-selectors {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.selector-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.selector-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
}

.date-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.3s ease;
  min-width: 100px;
}

.date-select:hover {
  border-color: #3498db;
}

.date-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
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

.sii-fetch-btn {
  background: #e74c3c;
  margin-right: 0.5rem;
}

.sii-fetch-btn:hover {
  background: #c0392b;
}

.wake-up-btn {
  background: #ff9500;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.wake-up-btn:hover {
  background: #e6851a;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 149, 0, 0.3);
}

.wake-up-btn.server-warm {
  background: #28a745;
  border: 2px solid #20c997;
}

.wake-up-btn.server-warm:hover {
  background: #218838;
  border-color: #17a2b8;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.wake-up-btn:disabled {
  background: #f39c12;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.wake-up-btn:disabled::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

.secondary-btn {
  background: #6c757d;
}

.secondary-btn:hover {
  background: #5a6268;
}

.sii-error {
  border-left: 4px solid #e74c3c;
  background: #fdf2f2 !important;
}

/* SII Loading Overlay Styles */
.sii-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in-out;
}

.sii-loading-content {
  background: white;
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideInUp 0.4s ease-out;
}

.sii-loading-spinner {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 2rem;
}

.spinner-ring {
  position: absolute;
  width: 80px;
  height: 80px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #525252;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-inner {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 60px;
  height: 60px;
  border: 3px solid #f8f9fa;
  border-bottom: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1.5s linear infinite reverse;
}

.sii-loading-content h3 {
  color: #2c3e50;
  margin: 0 0 1rem 0;
  font-size: 1.5em;
  font-weight: 600;
}

.loading-message {
  color: #666;
  font-size: 1.1em;
  margin: 0 0 0.5rem 0;
  font-weight: 500;
}

.loading-submessage {
  color: #999;
  font-size: 0.9em;
  margin: 0 0 2rem 0;
  font-style: italic;
}

.loading-progress {
  margin: 2rem 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #525252, #3498db, #525252);
  background-size: 200% 100%;
  animation: progressFlow 2s ease-in-out infinite;
  border-radius: 4px;
}

.progress-text {
  color: #666;
  font-size: 0.9em;
  font-weight: 500;
}

.loading-tips {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
  text-align: left;
}

.loading-tips h4 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.loading-tips ul {
  margin: 0;
  padding-left: 1.5rem;
  list-style: none;
}

.loading-tips li {
  margin: 0.75rem 0;
  color: #555;
  font-size: 0.9em;
  position: relative;
  padding-left: 1.5rem;
}

.loading-tips li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: #28a745;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes progressFlow {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    transform: translateY(-50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.2);
  }
}

/* Server status indicator */
.server-status {
  margin: 1rem 0;
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  display: flex;
  justify-content: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff9500;
  animation: pulse 1.5s infinite;
}

.status-indicator.warming .status-dot {
  background: #ff9500;
}

.status-text {
  font-size: 0.9rem;
  color: #856404;
  font-weight: 500;
}

/* Mobile responsive for loading overlay */
@media (max-width: 768px) {
  .sii-loading-content {
    padding: 2rem 1.5rem;
    margin: 1rem;
  }

  .sii-loading-spinner {
    width: 60px;
    height: 60px;
    margin-bottom: 1.5rem;
  }

  .spinner-ring {
    width: 60px;
    height: 60px;
  }

  .spinner-inner {
    top: 8px;
    left: 8px;
    width: 44px;
    height: 44px;
  }

  .sii-loading-content h3 {
    font-size: 1.3em;
  }

  .loading-tips {
    padding: 1rem;
  }

  .loading-tips li {
    font-size: 0.85em;
  }
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

/* Global Search Styles */
.global-search-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.search-container {
  max-width: 600px;
  margin: 0 auto;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.search-input-wrapper:focus-within {
  border-color: #3498db;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.15);
  transform: translateY(-1px);
}

.search-icon {
  position: absolute;
  left: 1rem;
  color: #6c757d;
  z-index: 2;
  pointer-events: none;
}

.global-search-input {
  width: 100%;
  padding: 1rem 1rem 1rem 3rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  background: transparent;
  outline: none;
  color: #2c3e50;
  font-weight: 500;
}

.global-search-input::placeholder {
  color: #adb5bd;
  font-weight: 400;
}

.clear-search-btn {
  position: absolute;
  right: 0.75rem;
  background: #f8f9fa;
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6c757d;
}

.clear-search-btn:hover {
  background: #e9ecef;
  color: #495057;
  transform: scale(1.1);
}

.search-results-info {
  margin-top: 0.75rem;
  text-align: center;
}

.search-results-text {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 500;
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: inline-block;
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
  flex-wrap: wrap;
}

.excel-export-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.excel-export-btn:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.excel-export-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(40, 167, 69, 0.3);
}

.column-toggle-btn, .filter-toggle-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
}

.column-toggle-btn:hover, .filter-toggle-btn:hover {
  background: #5a6268;
}

.results-count {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

/* Table Scroll Controls */
.table-scroll-controls {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.scroll-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.scroll-label {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
}

.scroll-buttons {
  display: flex;
  gap: 0.25rem;
}

.scroll-btn {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 600;
  color: #555;
}

.scroll-btn:hover {
  background: #e9ecef;
  border-color: #3498db;
  color: #3498db;
}

.scroll-btn:active {
  transform: translateY(1px);
}

/* Column Controls Panel */
.column-controls-panel {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.column-presets {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.preset-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.preset-btn.essential {
  border-color: #28a745;
  color: #28a745;
}

.preset-btn.essential:hover {
  background: #28a745;
  color: white;
}

.preset-btn.default {
  border-color: #007bff;
  color: #007bff;
}

.preset-btn.default:hover {
  background: #007bff;
  color: white;
}

.preset-btn.all {
  border-color: #6c757d;
  color: #6c757d;
}

.preset-btn.all:hover {
  background: #6c757d;
  color: white;
}

.column-toggles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.column-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.column-toggle:hover {
  background-color: #e9ecef;
}

.column-toggle input[type="checkbox"] {
  margin: 0;
  transform: scale(1.1);
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
  margin-top: 0;
  border-radius: 0 0 8px 8px;
  border: 1px solid #dee2e6;
  border-top: none;
  background: white;
}

.compras-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  min-width: fit-content;
}

.compras-table th {
  background: #f8f9fa;
  padding: 0.75rem 0.5rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 10;
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
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compras-table tr:hover {
  background: #f8f9fa;
}

/* Optimized column widths */
.compras-table th:nth-child(1),
.compras-table td:nth-child(1) { /* Tipo DTE */
  width: 100px;
  min-width: 80px;
}

.compras-table th:nth-child(2),
.compras-table td:nth-child(2) { /* RUT Proveedor */
  width: 110px;
  min-width: 100px;
}

.compras-table th:nth-child(3),
.compras-table td:nth-child(3) { /* Razón Social */
  width: 200px;
  min-width: 150px;
  max-width: 250px;
}

.compras-table th:nth-child(4),
.compras-table td:nth-child(4) { /* Folio */
  width: 120px;
  min-width: 60px;
  text-align: left;
}

.compras-table th:nth-child(5),
.compras-table td:nth-child(5) { /* Fecha */
  width: 100px;
  min-width: 90px;
}

.compras-table th:nth-child(6),
.compras-table td:nth-child(6) { /* Monto Neto */
  width: 110px;
  min-width: 100px;
  text-align: left;
}

.compras-table th:nth-child(7),
.compras-table td:nth-child(7) { /* IVA */
  width: 100px;
  min-width: 90px;
  text-align: right;
}

.compras-table th:nth-child(8),
.compras-table td:nth-child(8) { /* Monto Total */
  width: 120px;
  min-width: 110px;
  text-align: right;
}

.compras-table th:nth-child(9),
.compras-table td:nth-child(9) { /* Estado */
  width: 90px;
  min-width: 80px;
}

.compras-table th:nth-child(10),
.compras-table td:nth-child(10) { /* Contabilizado */
  width: 90px;
  min-width: 80px;
  text-align: center;
}

.compras-table th:nth-child(11),
.compras-table td:nth-child(11) { /* Pagado */
  width: 90px;
  min-width: 80px;
  text-align: center;
}

.compras-table th:nth-child(12),
.compras-table td:nth-child(12) { /* Comentario */
  width: 200px;
  min-width: 150px;
  max-width: 300px;
}

.compras-table th:nth-child(13),
.compras-table td:nth-child(13) { /* Descargar */
  width: 60px;
  min-width: 50px;
  text-align: center;
  padding: 0.5rem 0.25rem;
}

.razon-social {
  max-width: 250px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.amount {
  text-align: right !important;
  font-family: 'Courier New', monospace;
  font-weight: 500;
  font-size: 0.85em;
}

.amount.total {
  font-weight: 700;
  color: #27ae60;
}

.estado-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
  display: inline-block;
}

.estado-confirmada {
  background: #d4edda;
  color: #155724;
}

.estado-pendiente {
  background: #fff3cd;
  color: #856404;
}

.download-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.3rem;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  width: 28px;
  height: 28px;
  margin: 0 auto;
}

.download-btn:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.download-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.download-btn svg {
  width: 14px;
  height: 14px;
}

/* Comment styles */
.comment-cell {
  min-width: 200px;
  max-width: 300px;
}

/* Contabilizado checkbox styles */
.contabilizado-cell {
  text-align: center;
  padding: 0.5rem 0.25rem;
}

/* Pagado checkbox styles */
.pagado-cell {
  text-align: center;
  padding: 0.5rem 0.25rem;
}

.checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.contabilizado-checkbox, .pagado-checkbox {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: #28a745;
  transform: scale(1.2);
}

.contabilizado-checkbox:checked, .pagado-checkbox:checked {
  background-color: #28a745;
}

.contabilizado-checkbox:hover, .pagado-checkbox:hover {
  transform: scale(1.3);
  transition: transform 0.2s ease;
}

.checkmark {
  display: none; /* Hide custom checkmark for now, use native checkbox */
}

.comment-wrapper {
  width: 100%;
}

.comment-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #3498db;
  border-radius: 4px;
  font-size: 0.9rem;
  outline: none;
  background: white;
}

.comment-input:focus {
  border-color: #2980b9;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.comment-display {
  padding: 0.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  min-height: 2.2rem;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  line-height: 1.2;
  word-break: break-word;
}

.comment-display:hover {
  background: #f8f9fa;
  border-color: #dee2e6;
}

.comment-display.empty-comment {
  color: #6c757d;
  font-style: italic;
}

.comment-display.empty-comment:hover {
  color: #495057;
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
    align-items: stretch;
  }

  .header-controls {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .date-selectors {
    justify-content: center;
    flex-wrap: wrap;
  }

  .selector-group {
    flex: 1;
    min-width: 120px;
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
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .excel-export-btn {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
    flex: 1;
    justify-content: center;
    min-width: 120px;
  }

  .column-presets {
    justify-content: center;
  }

  .column-toggles {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: center;
  }

  /* Mobile search styles */
  .global-search-section {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
  }

  .search-container {
    max-width: 100%;
  }

  .search-input-wrapper {
    border-radius: 8px;
  }

  .global-search-input {
    padding: 0.75rem 0.75rem 0.75rem 2.5rem;
    font-size: 0.9rem;
  }

  .global-search-input::placeholder {
    font-size: 0.85rem;
  }

  .search-icon {
    left: 0.75rem;
    width: 18px;
    height: 18px;
  }

  .clear-search-btn {
    right: 0.5rem;
    width: 28px;
    height: 28px;
  }

  .search-results-text {
    font-size: 0.8rem;
    padding: 0.4rem 0.75rem;
  }

  /* Mobile scroll controls */
  .table-scroll-controls {
    padding: 0.5rem;
  }

  .scroll-info {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }

  /* Mobile table optimization */
  .table-container {
    border-radius: 4px;
  }

  .compras-table {
    font-size: 0.75rem;
  }

  .compras-table th,
  .compras-table td {
    padding: 0.4rem 0.3rem;
  }

  /* Ensure essential columns are visible on mobile */
  .compras-table th:nth-child(1),
  .compras-table td:nth-child(1) { /* Tipo DTE */
    width: 70px;
    min-width: 60px;
  }

  .compras-table th:nth-child(2),
  .compras-table td:nth-child(2) { /* RUT Proveedor */
    width: 90px;
    min-width: 80px;
  }

  .compras-table th:nth-child(3),
  .compras-table td:nth-child(3) { /* Razón Social */
    width: 120px;
    min-width: 100px;
    max-width: 150px;
  }

  .compras-table th:nth-child(4),
  .compras-table td:nth-child(4) { /* Folio */
    width: 70px;
    min-width: 50px;
    text-align: left;
  }
  .compras-table th:nth-child(5),
  .compras-table td:nth-child(5) { /* Fecha */
    width: 80px;
    min-width: 70px;
  }

  .compras-table th:nth-child(8),
  .compras-table td:nth-child(8) { /* Monto Total */
    width: 90px;
    min-width: 80px;
  }

  .download-btn {
    padding: 0.2rem;
    min-width: 24px;
    height: 24px;
  }

  .download-btn svg {
    width: 12px;
    height: 12px;
  }

  .estado-badge {
    padding: 0.15rem 0.4rem;
    font-size: 0.7em;
  }

  /* Hide less critical columns by default on mobile */
  .column-visibility-mobile {
    display: none;
  }
}

@media (max-width: 480px) {
  .consultas-view {
    padding: 0.5rem;
  }

  .column-toggles {
    grid-template-columns: 1fr;
  }

  .table-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .column-presets {
    flex-direction: column;
    gap: 0.25rem;
  }

  .compras-table {
    font-size: 0.7rem;
  }

  .compras-table th,
  .compras-table td {
    padding: 0.3rem 0.2rem;
  }

  .scroll-btn {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }

  .table-scroll-controls {
    padding: 0.4rem;
  }

  /* Small screen search styles */
  .global-search-input::placeholder {
    content: "Buscar...";
  }

  .search-results-text {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
  }
}
</style>
