import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const limpiarArchivos = (archivos: Express.Multer.File[], desde: number) => {
  for (let i = desde; i < archivos.length; i++) {
    const ruta = archivos[i]!.path   // ya es ruta absoluta
    if (fs.existsSync(ruta)) fs.unlink(ruta, () => {})
  }
}

/**
 * Fusiona múltiples archivos PDF en uno solo.
 * Devuelve el archivo resultante (siempre el primero, sobreescrito con el merge).
 * Elimina los archivos temporales sobrantes.
 */
export async function mergePdfs(archivos: Express.Multer.File[]): Promise<Express.Multer.File> {
  if (archivos.length === 0) throw new Error('No se recibieron archivos')
  if (archivos.length === 1) return archivos[0] as Express.Multer.File

  const mergedPdf = await PDFDocument.create()

  for (const archivo of archivos) {
    const bytes = fs.readFileSync(archivo.path)   // ruta absoluta directa
    const doc = await PDFDocument.load(bytes)
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
    pages.forEach((page) => mergedPdf.addPage(page))
  }

  const mergedBytes = await mergedPdf.save()

  // Sobreescribir el primer archivo con el PDF fusionado
  const primerArchivo = archivos[0] as Express.Multer.File
  fs.writeFileSync(primerArchivo.path, mergedBytes)   // ruta absoluta directa

  // Eliminar archivos sobrantes (índice 1 en adelante)
  limpiarArchivos(archivos, 1)

  const stat = fs.statSync(primerArchivo.path)
  return {
    ...primerArchivo,
    size: stat.size,
    originalname: primerArchivo.originalname.replace(/\.pdf$/i, '') + '_fusionado.pdf',
  } as Express.Multer.File
}
