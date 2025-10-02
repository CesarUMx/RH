import { Router } from 'express'
import { 
  listarAreas,
  crearArea,
  actualizarArea,
  eliminarArea,
  listarCoordinadores,
  asignarCoordinador,
  eliminarCoordinador
} from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'

export const areasRouter = Router()

// Rutas para gestión de áreas (solo ADMIN)
areasRouter.get('/', requireAuth, listarAreas)
areasRouter.post('/', requireAuth, requireRole(['ADMIN']), crearArea)
areasRouter.put('/:id', requireAuth, requireRole(['ADMIN']), actualizarArea)
areasRouter.delete('/:id', requireAuth, requireRole(['ADMIN']), eliminarArea)

// Rutas para coordinadores (ADMIN y RH)
// IMPORTANTE: Las rutas específicas deben ir antes de las rutas con parámetros
areasRouter.get('/:id/coordinadores', requireAuth, listarCoordinadores)
areasRouter.post('/:id/coordinadores', requireAuth, requireRole(['ADMIN', 'RH']), asignarCoordinador)
areasRouter.delete('/:id/coordinadores/:userId', requireAuth, requireRole(['ADMIN', 'RH']), eliminarCoordinador)
