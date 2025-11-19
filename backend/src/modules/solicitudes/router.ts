import { Router, Request, Response, NextFunction } from 'express'
import { 
  crearSolicitudAlta,
  listarSolicitudes,
  listarSolicitudesPendientes,
  subirDocumentoSolicitud,
  actualizarEstadoSolicitud
} from './controller'
import {
  crearSolicitudBaja,
  actualizarEstadoSolicitudBaja,
  listarSolicitudesBaja
} from './solicitudesBaja.controller'
import { requireAuth, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import multer from 'multer'

export const solicitudesRouter = Router()

// Middleware para manejar errores de multer
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    // Errores específicos de multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido de 10MB' })
    }
    return res.status(400).json({ error: `Error al subir archivo: ${err.message}` })
  } else if (err) {
    // Otros errores (como los del fileFilter)
    return res.status(400).json({ error: err.message || 'Error al subir archivo' })
  }
  next()
}

// Crear solicitud de alta (COORD)
solicitudesRouter.post(
  '/alta',
  requireAuth,
  requireRole(['ADMIN', 'RH', 'COORD']),
  crearSolicitudAlta
)

// Listar todas las solicitudes con filtro opcional por estado (ADMIN y RH)
solicitudesRouter.get(
  '/',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  listarSolicitudes
)

// Listar solicitudes pendientes (ADMIN y RH) - Mantenido por compatibilidad
solicitudesRouter.get(
  '/pendientes',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  listarSolicitudesPendientes
)

// Subir documento para una solicitud (COORD)
solicitudesRouter.post(
  '/alta/:id/documentos',
  requireAuth,
  requireRole(['ADMIN', 'RH', 'COORD']),
  upload.single('documento'),
  handleMulterError,
  subirDocumentoSolicitud
)

// Actualizar estado de una solicitud (ADMIN y RH)
solicitudesRouter.patch(
  '/alta/:id/estado',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  actualizarEstadoSolicitud
)

// Crear solicitud de baja (COORD)
solicitudesRouter.post(
  '/baja',
  requireAuth,
  requireRole(['ADMIN', 'RH', 'COORD']),
  crearSolicitudBaja
)

// Listar solicitudes de baja (ADMIN y RH)
solicitudesRouter.get(
  '/baja',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  listarSolicitudesBaja
)

// Actualizar estado de una solicitud de baja (ADMIN y RH)
solicitudesRouter.patch(
  '/baja/:id/estado',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  actualizarEstadoSolicitudBaja
)
