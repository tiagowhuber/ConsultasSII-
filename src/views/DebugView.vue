<template>
  <div class="debug-view">
    <h1>Debug - Backend Integration Test</h1>

    <div class="test-section">
      <h2>API Connectivity Tests</h2>

      <div class="test-buttons">
        <button @click="testEmpresas" :disabled="loading">Test Empresas</button>
        <button @click="testTiposDte" :disabled="loading">Test Tipos DTE</button>
        <button @click="testProveedores" :disabled="loading">Test Proveedores</button>
        <button @click="testPeriodos" :disabled="loading">Test Períodos</button>
        <button @click="testResumenCompras" :disabled="loading">Test Resumen Compras</button>
        <button @click="testDetalleCompras" :disabled="loading">Test Detalle Compras</button>
      </div>

      <div v-if="loading" class="loading">Testing...</div>

      <div v-if="error" class="error">
        <h3>Error:</h3>
        <pre>{{ error }}</pre>
      </div>

      <div v-if="result" class="result">
        <h3>Result:</h3>
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </div>

    <div class="store-state">
      <h2>Store State</h2>
      <div class="state-grid">
        <div class="state-item">
          <h3>Empresas ({{ formsStore.empresas.length }})</h3>
          <pre>{{ JSON.stringify(formsStore.empresas, null, 2) }}</pre>
        </div>

        <div class="state-item">
          <h3>Tipos DTE ({{ formsStore.tiposDte.length }})</h3>
          <pre>{{ JSON.stringify(formsStore.tiposDte, null, 2) }}</pre>
        </div>

        <div class="state-item">
          <h3>Proveedores ({{ formsStore.proveedores.length }})</h3>
          <pre>{{ JSON.stringify(formsStore.proveedores.slice(0, 5), null, 2) }}</pre>
        </div>

        <div class="state-item">
          <h3>Períodos ({{ formsStore.periodos.length }})</h3>
          <pre>{{ JSON.stringify(formsStore.periodos, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFormsStore } from '@/stores/dte';

const formsStore = useFormsStore();

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<unknown>(null);

const runTest = async (testFunction: () => Promise<unknown>, testName: string) => {
  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    console.log(`Running test: ${testName}`);
    const response = await testFunction();
    result.value = response;
    console.log(`Test ${testName} completed:`, response);
  } catch (err: unknown) {
    console.error(`Test ${testName} failed:`, err);
    const errorObj = err as { response?: { data?: unknown }; message?: string };
    error.value = String(errorObj.response?.data || errorObj.message || err);
  } finally {
    loading.value = false;
  }
};

const testEmpresas = () => runTest(() => formsStore.loadEmpresas(), 'Empresas');
const testTiposDte = () => runTest(() => formsStore.loadTiposDte(), 'Tipos DTE');
const testProveedores = () => runTest(() => formsStore.loadProveedores(), 'Proveedores');

const testPeriodos = () => runTest(() => {
  const rutEmpresa = '65.145.564-2'; // Default test RUT
  return formsStore.loadPeriodosByEmpresa(rutEmpresa, '2025', '08');
}, 'Períodos');

const testResumenCompras = () => runTest(() => {
  // Use the first periodo if available
  const periodoId = formsStore.periodos[0]?.periodoId?.toString();
  return formsStore.loadResumenCompras(periodoId);
}, 'Resumen Compras');

const testDetalleCompras = () => runTest(() => {
  // Use the first periodo if available
  const periodoId = formsStore.periodos[0]?.periodoId?.toString();
  return formsStore.loadDetalleCompras(periodoId);
}, 'Detalle Compras');
</script>

<style scoped>
.debug-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  font-family: 'Courier New', monospace;
}

.test-section {
  margin-bottom: 3rem;
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
}

.test-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.test-buttons button {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.test-buttons button:hover:not(:disabled) {
  background: #0056b3;
}

.test-buttons button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.loading {
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  color: #856404;
}

.error {
  padding: 1rem;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
}

.error pre {
  margin: 0.5rem 0 0 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.result {
  padding: 1rem;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  color: #155724;
}

.result pre {
  margin: 0.5rem 0 0 0;
  font-size: 0.8rem;
  max-height: 300px;
  overflow-y: auto;
}

.store-state {
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f8f9fa;
}

.state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.state-item {
  padding: 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.state-item h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1rem;
}

.state-item pre {
  font-size: 0.7rem;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  color: #666;
}

h1, h2 {
  color: #333;
  margin-bottom: 1rem;
}

h1 {
  border-bottom: 2px solid #007bff;
  padding-bottom: 0.5rem;
}
</style>
