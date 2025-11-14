import { Router } from 'express'
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

export const solicitudesRouter = Router()

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
