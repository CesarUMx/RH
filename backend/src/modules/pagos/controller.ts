import { Request, Response } from 'express'
import { PrismaClient, EstadoPeriodo, Prisma } from '@prisma/client'
import { JwtPayload } from '../../middlewares/auth'
import * as ExcelJS from 'exceljs'

const prisma = new PrismaClient()

/**
 * GET /reporte - Obtiene el reporte de pagos
 * 
 * Query params:
 * - periodoId: ID del periodo
 * - areaId: ID del área (opcional)
 * - tipo: Tipo de reporte ('general', 'area', 'docente')
 * - page: Número de página (default: 1)
 * - pageSize: Tamaño de página (default: 10)
 * - query: Consulta de búsqueda (opcional)
 * 
 * Devuelve una lista paginada de cargas de horas agrupadas según el tipo de reporte
 */
export async function getReportePagos(req: Request, res: Response) {
  try {
    // Obtener usuario autenticado
    const user = req.user as JwtPayload
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Verificar que el usuario tenga rol ADMIN o RH
    if (!user.roles.includes('ADMIN') && !user.roles.includes('RH')) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'Solo los administradores y personal de RH pueden acceder al reporte de pagos' 
      })
    }

    // Obtener parámetros de consulta
    const periodoId = Number(req.query.periodoId || 0)
    const areaId = req.query.areaId ? Number(req.query.areaId) : undefined
    const tipo = (req.query.tipo as string) || 'general'
    const page = Number(req.query.page || 1)
    const pageSize = Number(req.query.pageSize || 10)
    const query = (req.query.query as string) || ''
    
    // Validar parámetros requeridos
    if (!periodoId || isNaN(periodoId)) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        mensaje: 'El ID del periodo es requerido y debe ser un número' 
      })
    }

    // Verificar que el periodo exista
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId }
    })

    if (!periodo) {
      return res.status(404).json({ 
        error: 'Periodo no encontrado', 
        mensaje: `No existe un periodo con ID ${periodoId}` 
      })
    }

    // Construir la condición de búsqueda base
    const whereCondition: any = {
      periodoId
    }

    // Si se especifica un área, filtrar por ella
    if (areaId) {
      whereCondition.areaId = areaId
    }

    // Si hay una consulta de búsqueda, buscar por nombre de docente o materia
    if (query) {
      whereCondition.OR = [
        {
          docente: {
            nombre: {
              contains: query,
              mode: 'insensitive'
            }
          }
        },
        {
          materiaText: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Calcular el offset para la paginación
    const skip = (page - 1) * pageSize

    // Obtener el total de registros
    const total = await prisma.cargaHoras.count({
      where: whereCondition
    })

    // Calcular el total de páginas
    const totalPages = Math.ceil(total / pageSize)

    // Obtener los registros paginados con la información necesaria
    const cargas = await prisma.cargaHoras.findMany({
      where: whereCondition,
      include: {
        docente: {
          select: {
            id: true,
            codigoInterno: true,
            nombre: true,
            rfc: true
          }
        },
        area: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: [
        { areaId: 'asc' },
        { docente: { nombre: 'asc' } },
        { materiaText: 'asc' }
      ],
      skip,
      take: pageSize
    })

    // Transformar los datos según el tipo de reporte
    const reporteData = cargas.map(carga => ({
      id: carga.id,
      periodoId: carga.periodoId,
      areaId: carga.areaId,
      area: carga.area.nombre,
      docenteId: carga.docenteId,
      codigoInterno: carga.docente.codigoInterno,
      nombreDocente: carga.docente.nombre,
      rfc: carga.docente.rfc,
      materiaText: carga.materiaText,
      horas: Number(carga.horas),
      costoHora: Number(carga.costoHora),
      importe: Number(carga.horas) * Number(carga.costoHora),
      pagable: carga.pagable
    }))

    // Devolver los resultados
    return res.json({
      data: reporteData,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error al obtener reporte de pagos:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// La función exportarReportePDF ha sido eliminada ya que solo se requiere exportación a Excel

/**
 * GET /exportar/excel - Exporta el reporte de pagos a Excel
 * 
 * Query params:
 * - periodoId: ID del periodo
 * - areaId: ID del área (opcional)
 * 
 * Devuelve un archivo Excel con el reporte de pagos por docente y área
 */
export async function exportarReporteExcel(req: Request, res: Response) {
  try {
    // Obtener usuario autenticado
    const user = req.user as JwtPayload
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Verificar que el usuario tenga rol ADMIN o RH
    if (!user.roles.includes('ADMIN') && !user.roles.includes('RH')) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'Solo los administradores y personal de RH pueden exportar reportes' 
      })
    }

    // Obtener parámetros de consulta
    const periodoId = Number(req.query.periodoId || 0)
    
    // Validar parámetros requeridos
    if (!periodoId || isNaN(periodoId)) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        mensaje: 'El ID del periodo es requerido y debe ser un número' 
      })
    }

    // Verificar que el periodo exista
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId }
    })

    if (!periodo) {
      return res.status(404).json({ 
        error: 'Periodo no encontrado', 
        mensaje: `No existe un periodo con ID ${periodoId}` 
      })
    }

    // Obtener todas las áreas activas
    const areas = await prisma.area.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    })

    // Obtener todas las cargas del periodo
    const cargas = await prisma.cargaHoras.findMany({
      where: { periodoId },
      include: {
        docente: {
          select: {
            id: true,
            codigoInterno: true,
            nombre: true,
            rfc: true
          }
        },
        area: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    })

    // Agrupar cargas por docente y área
    const docentesMap = new Map()
    
    cargas.forEach(carga => {
      const docenteId = carga.docenteId
      const areaId = carga.areaId
      const importe = Number(carga.horas) * Number(carga.costoHora)
      
      if (!docentesMap.has(docenteId)) {
        docentesMap.set(docenteId, {
          codigo: carga.docente.codigoInterno,
          nombre: carga.docente.nombre,
          rfc: carga.docente.rfc,
          areas: {},
          total: 0
        })
      }
      
      const docente = docentesMap.get(docenteId)
      
      if (!docente.areas[areaId]) {
        docente.areas[areaId] = 0
      }
      
      docente.areas[areaId] += importe
      docente.total += importe
    })

    // Crear un libro de Excel
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'UMx RH'
    workbook.created = new Date()
    
    // Crear una hoja de trabajo
    const worksheet = workbook.addWorksheet('Reporte de Pagos')
    
    // Definir encabezados
    const headers = ['Código', 'NOMBRE', 'RFC']
    
    // Agregar áreas como encabezados
    areas.forEach(area => {
      headers.push(area.nombre)
    })
    
    // Agregar columna de total
    headers.push('TOTAL')
    
    // Agregar encabezados
    worksheet.addRow(headers)
    
    // Estilo para encabezados
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    }
    
    // Convertir el mapa a un array y ordenar por nombre de docente
    const docentes = Array.from(docentesMap.values())
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    
    // Agregar datos de docentes
    docentes.forEach(docente => {
      const row = [docente.codigo, docente.nombre, docente.rfc]
      
      // Agregar importes por área
      areas.forEach(area => {
        const importe = docente.areas[area.id] || 0
        row.push(importe)
      })
      
      // Agregar total
      row.push(docente.total)
      
      worksheet.addRow(row)
    })
    
    // Calcular totales por columna
    const totalRow = ['', 'TOTALES', '']
    
    // Calcular totales por área
    areas.forEach((area, index) => {
      const colIndex = index + 3 // Offset para las primeras columnas (Código, NOMBRE, RFC)
      let total = 0
      
      for (let i = 2; i <= docentes.length + 1; i++) {
        const cell = worksheet.getCell(i, colIndex + 1)
        total += Number(cell.value || 0)
      }
      
      totalRow.push(total.toString())
    })
    
    // Calcular total general
    let totalGeneral = 0
    for (let i = 2; i <= docentes.length + 1; i++) {
      const cell = worksheet.getCell(i, headers.length)
      totalGeneral += Number(cell.value || 0)
    }
    totalRow.push(totalGeneral.toString())
    
    // Agregar fila de totales
    worksheet.addRow(totalRow)
    
    // Estilo para la fila de totales
    const totalRowIndex = docentes.length + 2
    worksheet.getRow(totalRowIndex).font = { bold: true }
    
    // Formato de moneda para columnas de importes
    for (let i = 4; i <= headers.length; i++) { // Empezar desde la columna de áreas
      for (let j = 2; j <= totalRowIndex; j++) {
        try {
          worksheet.getCell(j, i).numFmt = '"$"#,##0.00'
        } catch (err) {
          console.warn('Error al formatear celda:', err)
        }
      }
    }
    
    // Ajustar ancho de columnas
    worksheet.columns.forEach((column: any) => {
      column.width = 15
    })
    
    // Agregar información del reporte
    worksheet.insertRow(1, [])
    worksheet.insertRow(1, [`Periodo: ${periodo.nombre}`])
    worksheet.insertRow(1, [`Fecha: ${new Date().toLocaleDateString()}`])
    worksheet.insertRow(1, [`REPORTE DE PAGOS - ${periodo.nombre}`])
    
    // Estilo para el título
    worksheet.getCell('A1').font = { bold: true, size: 16 }
    worksheet.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`)
    worksheet.getCell('A1').alignment = { horizontal: 'center' }
    
    // Escribir a un buffer
    const buffer = await workbook.xlsx.writeBuffer()
    
    // Configurar la respuesta HTTP
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=reporte-pagos-${periodo.nombre}.xlsx`)
    
    // Enviar el buffer como respuesta
    res.send(buffer)
  } catch (error) {
    console.error('Error al exportar reporte a Excel:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
