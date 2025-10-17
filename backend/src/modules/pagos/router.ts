import { Router } from 'express'
import { getReportePagos, exportarReporteExcel, exportarReportesPorAreaZIP, exportarReportesPorAreaExcelMultihojas } from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'

export const pagosRouter = Router()

// Ruta para obtener el reporte de pagos (para la tabla en la interfaz)
pagosRouter.get('/reporte', requireAuth, requireRole(['ADMIN', 'RH']), getReportePagos)

// Ruta para exportar el reporte a Excel (formato especial con áreas como columnas)
pagosRouter.get('/exportar/excel', requireAuth, requireRole(['ADMIN', 'RH']), exportarReporteExcel)

// Ruta para exportar reportes por área en formato ZIP
pagosRouter.get('/exportar/areas/zip', requireAuth, requireRole(['ADMIN', 'RH']), exportarReportesPorAreaZIP)

// Ruta para exportar reportes por área en un solo Excel con múltiples hojas
pagosRouter.get('/exportar/areas/excel-multihojas', requireAuth, requireRole(['ADMIN', 'RH']), exportarReportesPorAreaExcelMultihojas)
