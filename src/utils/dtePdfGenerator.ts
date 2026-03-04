import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DetalleCompra } from '@/types/api'

export interface EmpresaInfo {
  rutEmpresa: string
  nombreEmpresa?: string
}

const formatCLP = (amount: number | null | undefined): string => {
  if (amount == null || amount === 0) return '$ 0'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount)
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const formatRut = (rut: string): string => {
  if (!rut) return rut
  // Add dots if not already formatted (e.g. "76123456-7" -> "76.123.456-7")
  const clean = rut.replace(/\./g, '')
  if (clean.includes('-')) {
    const [body, dv] = clean.split('-')
    const reversed = body.split('').reverse()
    const grouped = reversed.reduce((acc, d, i) => {
      return acc + d + (i > 0 && i % 3 === 2 ? '.' : '')
    }, '')
    return grouped.split('').reverse().join('').replace(/^\./, '') + '-' + dv
  }
  return rut
}

const MARGIN = 14
const PAGE_WIDTH = 210 // A4 mm

export function generateDtePdf(dte: DetalleCompra, empresa: EmpresaInfo): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // ─── Colours ──────────────────────────────────────────────────────────────
  const BLUE_DARK = [0, 51, 102] as [number, number, number]
  const BLUE_MID = [0, 102, 179] as [number, number, number]
  const BLUE_LIGHT = [230, 240, 250] as [number, number, number]
  const GREY_LIGHT = [245, 245, 245] as [number, number, number]
  const GREY_BORDER = [200, 200, 200] as [number, number, number]
  const WHITE = [255, 255, 255] as [number, number, number]
  const TEXT_DARK = [30, 30, 30] as [number, number, number]
  const TEXT_MID = [80, 80, 80] as [number, number, number]

  const RIGHT_BOX_X = 137
  const RIGHT_BOX_W = PAGE_WIDTH - RIGHT_BOX_X - MARGIN  // ~59mm
  const CONTENT_W = PAGE_WIDTH - MARGIN * 2              // ~182mm
  const LEFT_BOX_W = RIGHT_BOX_X - MARGIN - 3            // ~120mm

  let y = 12

  // ─── Top rule ─────────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE_DARK)
  doc.rect(MARGIN, y, CONTENT_W, 1.5, 'F')
  y += 4

  // ─── LEFT: Emisor block ───────────────────────────────────────────────────
  const emisorTopY = y
  doc.setFillColor(...BLUE_LIGHT)
  doc.rect(MARGIN, emisorTopY, LEFT_BOX_W, 32, 'F')
  doc.setDrawColor(...GREY_BORDER)
  doc.rect(MARGIN, emisorTopY, LEFT_BOX_W, 32, 'S')

  doc.setFontSize(7)
  doc.setTextColor(...BLUE_MID)
  doc.setFont('helvetica', 'bold')
  doc.text('EMISOR', MARGIN + 3, emisorTopY + 5)

  doc.setFontSize(13)
  doc.setTextColor(...BLUE_DARK)
  doc.setFont('helvetica', 'bold')
  const razonLines = doc.splitTextToSize(dte.razonSocial || '-', LEFT_BOX_W - 6)
  doc.text(razonLines, MARGIN + 3, emisorTopY + 11)

  const afterRazon = emisorTopY + 11 + (razonLines.length - 1) * 5 + 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_MID)
  doc.text(`RUT: ${formatRut(dte.rutProveedor)}`, MARGIN + 3, afterRazon)

  // ─── RIGHT: Document type / folio box ─────────────────────────────────────
  const rightY = emisorTopY
  const rightH = 32

  doc.setFillColor(...BLUE_DARK)
  doc.rect(RIGHT_BOX_X, rightY, RIGHT_BOX_W, rightH, 'F')

  // RUT emisor at top right
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...WHITE)
  doc.text(`RUT: ${formatRut(dte.rutProveedor)}`, RIGHT_BOX_X + RIGHT_BOX_W / 2, rightY + 6, { align: 'center' })

  // Divider
  doc.setDrawColor(...BLUE_MID)
  doc.line(RIGHT_BOX_X + 4, rightY + 8, RIGHT_BOX_X + RIGHT_BOX_W - 4, rightY + 8)

  // Document type label
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  const typeLines = doc.splitTextToSize(dte.tipoDTEString.toUpperCase(), RIGHT_BOX_W - 4)
  doc.text(typeLines, RIGHT_BOX_X + RIGHT_BOX_W / 2, rightY + 14, { align: 'center' })

  // Folio
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(`N° ${String(dte.folio).padStart(8, '0')}`, RIGHT_BOX_X + RIGHT_BOX_W / 2, rightY + 25, {
    align: 'center'
  })

  y = emisorTopY + 32 + 5

  // ─── Receptor row ─────────────────────────────────────────────────────────
  doc.setFillColor(...GREY_LIGHT)
  doc.rect(MARGIN, y, CONTENT_W, 10, 'F')
  doc.setDrawColor(...GREY_BORDER)
  doc.rect(MARGIN, y, CONTENT_W, 10, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE_DARK)
  doc.text('RECEPTOR:', MARGIN + 3, y + 4.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_DARK)
  const receptorName = empresa.nombreEmpresa || empresa.rutEmpresa
  doc.text(receptorName, MARGIN + 26, y + 4.5)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE_DARK)
  doc.text('RUT:', MARGIN + 26 + doc.getTextWidth(receptorName) + 4, y + 4.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_DARK)
  doc.text(
    formatRut(empresa.rutEmpresa),
    MARGIN + 26 + doc.getTextWidth(receptorName) + 4 + doc.getTextWidth('RUT:') + 2,
    y + 4.5
  )

  y += 15

  // ─── Metadata table ───────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: TEXT_DARK as [number,number,number] },
    headStyles: { fillColor: BLUE_DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: GREY_LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: BLUE_DARK, cellWidth: 40 },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', textColor: BLUE_DARK, cellWidth: 40 },
      3: { cellWidth: 'auto' }
    },
    body: [
      ['Fecha Emisión', formatDate(dte.fechaEmision), 'Fecha Recepción', formatDate(dte.fechaRecepcion)],
      ['Estado', dte.estado, 'Tipo Compra', dte.tipoCompra],
      ...(dte.acuseRecibo
        ? [['Acuse de Recibo', dte.acuseRecibo, 'Fecha Acuse', formatDate(dte.fechaAcuse)]]
        : [])
    ]
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6


  // ─── Amounts table ────────────────────────────────────────────────────────
  type AmountRow = [string, string]
  const amountRows: AmountRow[] = []

  if (dte.montoExento > 0) amountRows.push(['Monto Exento', formatCLP(dte.montoExento)])
  if (dte.montoNeto > 0) amountRows.push(['Monto Neto', formatCLP(dte.montoNeto)])
  if (dte.montoIvaRecuperable > 0) amountRows.push(['IVA Recuperable (19%)', formatCLP(dte.montoIvaRecuperable)])
  if (dte.montoIvaNoRecuperable > 0) amountRows.push(['IVA No Recuperable', formatCLP(dte.montoIvaNoRecuperable)])
  if (dte.ivaUsoComun > 0) amountRows.push(['IVA Uso Común', formatCLP(dte.ivaUsoComun)])
  if (dte.ivaActivoFijo > 0) amountRows.push(['IVA Activo Fijo', formatCLP(dte.ivaActivoFijo)])
  if (dte.montoNetoActivoFijo > 0) amountRows.push(['Monto Neto Activo Fijo', formatCLP(dte.montoNetoActivoFijo)])
  if (dte.ivaNoRetenido > 0) amountRows.push(['IVA No Retenido', formatCLP(dte.ivaNoRetenido)])
  if (dte.impuestoSinDerechoCredito > 0)
    amountRows.push(['Impuesto Sin Derecho a Crédito', formatCLP(dte.impuestoSinDerechoCredito)])
  if (dte.tabacosPuros) amountRows.push(['Tabacos Puros', formatCLP(dte.tabacosPuros)])
  if (dte.tabacosCigarrillos) amountRows.push(['Tabacos Cigarrillos', formatCLP(dte.tabacosCigarrillos)])
  if (dte.tabacosElaborados) amountRows.push(['Tabacos Elaborados', formatCLP(dte.tabacosElaborados)])
  if (dte.nceNdeFacturaCompra !== 0) amountRows.push(['NCE/NDE Fact. Compra', formatCLP(dte.nceNdeFacturaCompra)])

  // Other taxes from otrosImpuestos[]
  if (dte.otrosImpuestos?.length) {
    for (const oi of dte.otrosImpuestos) {
      const valor = parseFloat(oi.valor)
      const tasa = parseFloat(oi.tasa)
      if (valor) amountRows.push([`Otro Impuesto (cód ${oi.codigo}${tasa ? `, ${tasa}%` : ''})`, formatCLP(valor)])
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN + CONTENT_W * 0.4, right: MARGIN },
    tableWidth: CONTENT_W * 0.6,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 }, textColor: TEXT_DARK as [number,number,number] },
    alternateRowStyles: { fillColor: GREY_LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: TEXT_MID, cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 36 }
    },
    body: amountRows
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // Total bar
  const totalBarH = 10
  doc.setFillColor(...BLUE_DARK)
  doc.rect(MARGIN + CONTENT_W * 0.4, y, CONTENT_W * 0.6, totalBarH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL', MARGIN + CONTENT_W * 0.4 + 4, y + 6.5)
  doc.text(formatCLP(dte.montoTotal), PAGE_WIDTH - MARGIN - 4, y + 6.5, { align: 'right' })

  y += totalBarH + 10

  // ─── Internal notes section ───────────────────────────────────────────────
  const hasNotes = dte.formaPago || dte.contabilizado || dte.pagado || dte.comentario
  if (hasNotes) {
    doc.setDrawColor(...GREY_BORDER)
    doc.setFillColor(...GREY_LIGHT)
    doc.rect(MARGIN, y, CONTENT_W, 8, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BLUE_DARK)
    doc.text('NOTAS INTERNAS', MARGIN + 3, y + 5)
    y += 11

    const noteRows: [string, string][] = []
    if (dte.formaPago) noteRows.push(['Forma de Pago', dte.formaPago])
    noteRows.push(['Contabilizado', dte.contabilizado ? 'Sí' : 'No'])
    noteRows.push(['Pagado', dte.pagado ? 'Sí' : 'No'])
    if (dte.comentario) noteRows.push(['Comentario', dte.comentario])

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: TEXT_DARK as [number,number,number] },
      alternateRowStyles: { fillColor: WHITE },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: TEXT_MID, cellWidth: 50 },
        1: {}
      },
      body: noteRows
    })

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  const footerY = 285
  doc.setDrawColor(...GREY_BORDER)
  doc.line(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY)

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(130, 130, 130)
  doc.text(
    'Este documento es una representación de referencia. No incluye Timbre Electrónico (TED) ni firma digital del SII.',
    PAGE_WIDTH / 2,
    footerY + 4,
    { align: 'center' }
  )
  doc.text(
    'Para el documento legal oficial, consulte el sitio web del Servicio de Impuestos Internos (www.sii.cl).',
    PAGE_WIDTH / 2,
    footerY + 8,
    { align: 'center' }
  )

  // ─── Save ──────────────────────────────────────────────────────────────────
  const rutClean = dte.rutProveedor.replace(/\./g, '').replace('-', '')
  doc.save(`DTE_${dte.tipoDTE}_${rutClean}_${dte.folio}.pdf`)
}
