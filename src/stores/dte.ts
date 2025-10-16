import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dteApi } from '../services/api'
import type { FormResponse, DetalleCompra, ResumenCompra } from '../types/api'
import type {
  Empresa,
  Periodo,
  DetalleCompras,
  ResumenCompras,
  TipoDte,
  Proveedor
} from '../types/api'

export const useFormsStore = defineStore('forms', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const data = ref<FormResponse | null>(null)

  // New state for backend data
  const empresas = ref<Empresa[]>([])
  const selectedEmpresa = ref<Empresa | null>(null)
  const periodos = ref<Periodo[]>([])
  const selectedPeriodo = ref<Periodo | null>(null)
  const resumenCompras = ref<ResumenCompras[]>([])
  const detalleCompras = ref<DetalleCompras[]>([])
  const tiposDte = ref<TipoDte[]>([])
  const proveedores = ref<Proveedor[]>([])

  // Date selection state
  const currentMonth = ref('08')
  const currentYear = ref('2025')

  // Legacy method for backwards compatibility
  const getAll = async (month?: string, year?: string) => {
    const actualMonth = month || currentMonth.value
    const actualYear = year || currentYear.value

    loading.value = true
    error.value = null

    try {
      // For now, we'll use a default empresa RUT and try to get data from the new backend
      const rutEmpresa = '65.145.564-2'
      const anio = actualYear
      const mes = actualMonth

      // Get the empresa data
      const empresaResponse = await dteApi.getEmpresaByRut(rutEmpresa)
      selectedEmpresa.value = empresaResponse.data

      // Get periodos for the empresa
      const periodosResponse = await dteApi.getPeriodosByEmpresa(rutEmpresa, anio, mes)
      periodos.value = periodosResponse.data

      if (periodosResponse.data.length > 0) {
        selectedPeriodo.value = periodosResponse.data[0]
        const periodoId = selectedPeriodo.value.periodoId.toString()

        // Get resumen and detalle compras for this periodo
        const [resumenResponse, detalleResponse] = await Promise.all([
          dteApi.getResumenCompras(periodoId),
          dteApi.getDetalleCompras(periodoId)
        ])

        resumenCompras.value = resumenResponse.data
        detalleCompras.value = detalleResponse.data.data

        // Transform backend data to match the legacy format expected by the frontend
        const transformedData: FormResponse = {
          caratula: {
            rutEmpresa: selectedEmpresa.value.rutEmpresa,
            nombreMes: getMonthName(selectedPeriodo.value.mes),
            mes: selectedPeriodo.value.mes,
            anio: selectedPeriodo.value.anio,
            dia: null,
            periodo: `${selectedPeriodo.value.anio}${selectedPeriodo.value.mes.toString().padStart(2, '0')}`
          },
          compras: {
            resumenes: resumenCompras.value.map(transformResumenCompras),
            detalleCompras: detalleCompras.value.map(transformDetalleCompras)
          },
          ventas: {
            resumenes: [],
            detalleVentas: []
          }
        }

        data.value = transformedData
        return transformedData
      } else {
        throw new Error('No se encontraron períodos para la empresa y fecha especificada')
      }
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                           (err as { message?: string }).message || 'An error occurred'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  // New methods for direct backend data access
  const loadEmpresas = async () => {
    try {
      loading.value = true
      const response = await dteApi.getAllEmpresas()
      empresas.value = response.data
      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading empresas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadPeriodosByEmpresa = async (rutEmpresa: string, anio?: string, mes?: string) => {
    try {
      loading.value = true
      const response = await dteApi.getPeriodosByEmpresa(rutEmpresa, anio, mes)
      periodos.value = response.data
      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading períodos'
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadResumenCompras = async (periodoId?: string) => {
    try {
      loading.value = true
      const response = await dteApi.getResumenCompras(periodoId)
      resumenCompras.value = response.data
      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading resumen de compras'
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadDetalleCompras = async (periodoId?: string, filters?: Record<string, unknown>) => {
    try {
      loading.value = true
      const response = await dteApi.getDetalleCompras(periodoId, filters)
      detalleCompras.value = response.data.data
      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading detalle de compras'
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadTiposDte = async () => {
    try {
      const response = await dteApi.getAllTiposDte()
      tiposDte.value = response.data
      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading tipos DTE'
      throw err
    }
  }

  const loadProveedores = async (search?: string) => {
    try {
      const response = await dteApi.getAllProveedores(search)
      proveedores.value = response.data
      return response.data
    } catch (err: unknown) {
      error.value = (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
                   (err as { message?: string }).message || 'Error loading proveedores'
      throw err
    }
  }

  // Methods to update date selection
  const setMonth = (month: string) => {
    currentMonth.value = month
  }

  const setYear = (year: string) => {
    currentYear.value = year
  }

  const setMonthAndYear = (month: string, year: string) => {
    currentMonth.value = month
    currentYear.value = year
  }

  const refreshWithCurrentDate = async () => {
    return await getAll(currentMonth.value, currentYear.value)
  }

  // Helper functions
  const getMonthName = (monthNumber: number): string => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return months[monthNumber - 1] || 'Mes Desconocido'
  }

  const transformResumenCompras = (resumen: ResumenCompras): ResumenCompra => {
    return {
      tipoDte: resumen.tipoDte,
      tipoDteString: resumen.tipoDteInfo?.descripcion || `Tipo ${resumen.tipoDte}`,
      totalDocumentos: resumen.totalDocumentos,
      montoExento: parseFloat(resumen.montoExento),
      montoNeto: parseFloat(resumen.montoNeto),
      ivaRecuperable: parseFloat(resumen.montoIvaRecuperable),
      ivaUsoComun: 0, // This field might need mapping from backend
      ivaNoRecuperable: parseFloat(resumen.montoIvaNoRecuperable),
      montoTotal: parseFloat(resumen.montoTotal),
      estado: resumen.estado
    }
  }

  const transformDetalleCompras = (detalle: DetalleCompras): DetalleCompra => {
    return {
      tipoDTEString: detalle.tipoDteInfo?.descripcion || `Tipo ${detalle.tipoDte}`,
      tipoDTE: detalle.tipoDte,
      tipoCompra: detalle.tipoCompra,
      rutProveedor: detalle.rutProveedor,
      razonSocial: detalle.proveedor?.razonSocial || 'Sin razón social',
      folio: parseInt(detalle.folio),
      fechaEmision: detalle.fechaEmision,
      fechaRecepcion: detalle.fechaRecepcion,
      acuseRecibo: detalle.acuseRecibo || null,
      montoExento: parseFloat(detalle.montoExento),
      montoNeto: parseFloat(detalle.montoNeto),
      montoIvaRecuperable: parseFloat(detalle.montoIvaRecuperable),
      montoIvaNoRecuperable: parseFloat(detalle.montoIvaNoRecuperable),
      codigoIvaNoRecuperable: detalle.codigoIvaNoRecuperable || 0,
      montoTotal: parseFloat(detalle.montoTotal),
      montoNetoActivoFijo: parseFloat(detalle.montoNetoActivoFijo),
      ivaActivoFijo: parseFloat(detalle.ivaActivoFijo),
      ivaUsoComun: parseFloat(detalle.ivaUsoComun),
      impuestoSinDerechoCredito: parseFloat(detalle.impuestoSinDerechoCredito),
      ivaNoRetenido: parseFloat(detalle.ivaNoRetenido),
      tabacosPuros: detalle.tabacosPuros ? parseFloat(detalle.tabacosPuros) : null,
      tabacosCigarrillos: detalle.tabacosCigarrillos ? parseFloat(detalle.tabacosCigarrillos) : null,
      tabacosElaborados: detalle.tabacosElaborados ? parseFloat(detalle.tabacosElaborados) : null,
      nceNdeFacturaCompra: parseFloat(detalle.nceNdeFacturaCompra),
      valorOtroImpuesto: detalle.valorOtroImpuesto || '',
      tasaOtroImpuesto: detalle.tasaOtroImpuesto || '',
      codigoOtroImpuesto: detalle.codigoOtroImpuesto || 0,
      comentario: detalle.nota?.comentario || undefined,
      contabilizado: detalle.nota?.contabilizado || false,
      pagado: detalle.nota?.pagado || false,
      estado: detalle.estado,
      fechaAcuse: detalle.fechaAcuse || null,
      otrosImpuestos: detalle.otrosImpuestos?.map(oi => ({
        valor: oi.valor,
        tasa: oi.tasa,
        codigo: oi.codigo
      }))
    }
  }

  return {
    // Legacy state
    loading,
    error,
    data,

    // New state
    empresas,
    selectedEmpresa,
    periodos,
    selectedPeriodo,
    resumenCompras,
    detalleCompras,
    tiposDte,
    proveedores,

    // Date selection state
    currentMonth,
    currentYear,

    // Legacy actions
    getAll,

    // New actions
    loadEmpresas,
    loadPeriodosByEmpresa,
    loadResumenCompras,
    loadDetalleCompras,
    loadTiposDte,
    loadProveedores,

    // Date selection actions
    setMonth,
    setYear,
    setMonthAndYear,
    refreshWithCurrentDate
  }
})
