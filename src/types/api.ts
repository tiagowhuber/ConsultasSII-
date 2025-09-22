// Backend model types
export interface Empresa {
  rutEmpresa: string;
  razonSocial?: string;
  periodos?: Periodo[];
}

export interface Periodo {
  periodoId: number;
  rutEmpresa: string;
  anio: number;
  mes: number;
  empresa?: Empresa;
  resumenCompras?: ResumenCompras[];
}

export interface TipoDte {
  tipoDte: number;
  descripcion: string;
}

export interface Proveedor {
  rutProveedor: string;
  razonSocial: string;
}

export interface ResumenCompras {
  resumenId: number;
  periodoId: number;
  tipoDte: number;
  totalDocumentos: number;
  montoExento: string;
  montoNeto: string;
  montoIvaRecuperable: string;
  montoIvaNoRecuperable: string;
  montoTotal: string;
  estado: 'Confirmada' | 'Pendiente' | 'Rechazada';
  periodo?: Periodo;
  tipoDteInfo?: TipoDte;
}

export interface DetalleCompras {
  detalleId: number;
  periodoId: number;
  tipoDte: number;
  tipoCompra: string;
  rutProveedor: string;
  folio: string;
  fechaEmision: string;
  fechaRecepcion: string;
  acuseRecibo?: string;
  fechaAcuse?: string;
  montoExento: string;
  montoNeto: string;
  montoIvaRecuperable: string;
  montoIvaNoRecuperable: string;
  codigoIvaNoRecuperable?: number;
  montoTotal: string;
  montoNetoActivoFijo: string;
  ivaActivoFijo: string;
  ivaUsoComun: string;
  impuestoSinDerechoCredito: string;
  ivaNoRetenido: string;
  tabacosPuros?: string;
  tabacosCigarrillos?: string;
  tabacosElaborados?: string;
  nceNdeFacturaCompra: string;
  valorOtroImpuesto?: string;
  tasaOtroImpuesto?: string;
  codigoOtroImpuesto?: number;
  estado: 'Confirmada' | 'Pendiente' | 'Rechazada';
  periodo?: Periodo;
  tipoDteInfo?: TipoDte;
  proveedor?: Proveedor;
  otrosImpuestos?: OtrosImpuestos[];
}

export interface OtrosImpuestos {
  otroImpuestoId: number;
  detalleId: number;
  codigo: number;
  tasa: string;
  valor: string;
}

// Legacy types for compatibility with existing SII API format
export interface OtroImpuesto {
  valor: string;
  tasa: string;
  codigo: number;
}

export interface DetalleCompra {
  tipoDTEString: string;
  tipoDTE: number;
  tipoCompra: string;
  rutProveedor: string;
  razonSocial: string;
  folio: number;
  fechaEmision: string;
  fechaRecepcion: string;
  acuseRecibo: string | null;
  montoExento: number;
  montoNeto: number;
  montoIvaRecuperable: number;
  montoIvaNoRecuperable: number;
  codigoIvaNoRecuperable: number;
  montoTotal: number;
  montoNetoActivoFijo: number;
  ivaActivoFijo: number;
  ivaUsoComun: number;
  impuestoSinDerechoCredito: number;
  ivaNoRetenido: number;
  tabacosPuros: number | null;
  tabacosCigarrillos: number | null;
  tabacosElaborados: number | null;
  nceNdeFacturaCompra: number;
  valorOtroImpuesto: string;
  tasaOtroImpuesto: string;
  codigoOtroImpuesto: number;
  estado: string;
  fechaAcuse: string | null;
  otrosImpuestos?: OtroImpuesto[];
}

export interface ResumenCompra {
  tipoDte: number;
  tipoDteString: string;
  totalDocumentos: number;
  montoExento: number;
  montoNeto: number;
  ivaRecuperable: number;
  ivaUsoComun: number;
  ivaNoRecuperable: number;
  montoTotal: number;
  estado: string;
}

export interface Caratula {
  rutEmpresa: string;
  nombreMes: string;
  mes: number;
  anio: number;
  dia: number | null;
  periodo: string;
}

export interface Compras {
  resumenes: ResumenCompra[];
  detalleCompras: DetalleCompra[];
}

export interface Ventas {
  resumenes: unknown[];
  detalleVentas: unknown[];
}

export interface FormResponse {
  caratula: Caratula;
  compras: Compras;
  ventas: Ventas;
}
