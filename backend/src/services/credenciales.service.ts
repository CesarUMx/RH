import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

const credencialesDir = path.join(process.cwd(), 'uploads', 'credenciales')
if (!fs.existsSync(credencialesDir)) fs.mkdirSync(credencialesDir, { recursive: true })

/**
 * Genera el archivo PDF de credenciales institucionales.
 * Retorna la ruta relativa del archivo generado.
 */
export async function generarArchivoCredenciales(
  nombre: string,
  correoInstitucional: string,
  password: string,
  userId: number
): Promise<string> {
  const usuario = correoInstitucional.split('@')[0] ?? correoInstitucional
  const filename = `credenciales-${userId}-${Date.now()}.pdf`
  const filepath = path.join(credencialesDir, filename)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
    const stream = fs.createWriteStream(filepath)
    doc.pipe(stream)

    const NARANJA = '#D68910'
    const GRIS_OSCURO = '#2C3E50'
    const GRIS_MEDIO = '#555555'
    const PAGE_W = doc.page.width
    const MARGIN = 50

    // ── Banda superior naranja ─────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 80).fill(NARANJA)
    doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold')
       .text('CREDENCIALES INSTITUCIONALES', MARGIN, 22, { align: 'center' })
    doc.fontSize(10).fillColor('#FFFFFF').font('Helvetica')
       .text('Universidad Mondragón México', MARGIN, 50, { align: 'center' })

    // ── Nombre del colaborador ─────────────────────────────────────────
    doc.fontSize(11).fillColor(GRIS_MEDIO).font('Helvetica-Bold')
       .text('Colaborador', MARGIN, 100)
    doc.fontSize(16).fillColor(NARANJA).font('Helvetica-Bold')
       .text(nombre.toUpperCase(), MARGIN, 116)

    // ── Línea separadora ───────────────────────────────────────────────
    doc.moveTo(MARGIN, 148).lineTo(PAGE_W - MARGIN, 148)
       .strokeColor(NARANJA).lineWidth(2).stroke()

    // ── Tabla de credenciales ──────────────────────────────────────────
    const COL_LABEL = MARGIN
    const COL_VALUE = 230
    const ROW_H = 40
    let y = 164

    const filas: [string, string][] = [
      ['NOMBRE COMPLETO', nombre.toUpperCase()],
      ['CORREO INSTITUCIONAL', correoInstitucional],
      ['USUARIO', usuario],
      ['CONTRASEÑA GENERAL', password],
    ]

    filas.forEach(([label, value], i) => {
      const bg = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF'
      doc.rect(COL_LABEL - 6, y - 6, PAGE_W - (MARGIN * 2) + 12, ROW_H)
         .fill(bg)
      doc.fontSize(8).fillColor(GRIS_MEDIO).font('Helvetica-Bold')
         .text(label, COL_LABEL, y + 2)
      doc.fontSize(11).fillColor(GRIS_OSCURO).font('Helvetica')
         .text(value, COL_VALUE, y + 2, { width: PAGE_W - COL_VALUE - MARGIN })
      doc.moveTo(COL_LABEL - 6, y + ROW_H - 7)
         .lineTo(PAGE_W - MARGIN + 6, y + ROW_H - 7)
         .strokeColor('#DDDDDD').lineWidth(0.5).stroke()
      y += ROW_H
    })

    // ── Nota de seguridad ──────────────────────────────────────────────
    y += 18
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 58).fill('#FEF9E7')
    doc.rect(MARGIN, y, 4, 58).fill(NARANJA)
    doc.fontSize(9).fillColor('#7D6608').font('Helvetica-Bold')
       .text('IMPORTANTE', MARGIN + 12, y + 10)
    doc.fontSize(8.5).fillColor('#7D6608').font('Helvetica')
       .text(
         'Esta contraseña es temporal. Se solicitará cambiarla en el primer inicio de sesión.\n' +
         'Guarda este documento en un lugar seguro y no lo compartas con nadie.',
         MARGIN + 12, y + 24, { width: PAGE_W - MARGIN * 2 - 24 }
       )

    // ── Pie de página ──────────────────────────────────────────────────
    const footerY = doc.page.height - 45
    doc.rect(0, footerY, PAGE_W, 45).fill(NARANJA)
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica')
       .text(`Generado el ${fecha}  •  Recursos Humanos`, MARGIN, footerY + 16, { align: 'center' })

    doc.end()
    stream.on('finish', () => resolve(`uploads/credenciales/${filename}`))
    stream.on('error', reject)
  })
}
