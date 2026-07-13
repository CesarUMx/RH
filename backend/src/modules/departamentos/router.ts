import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth'
import {
  listarDepartamentos,
  crearDepartamento,
  actualizarDepartamento,
  eliminarDepartamento,
  asignarCoordinador,
  quitarCoordinador,
  listarDepartamentosConCoord,
  getMiembros,
} from './controller'

export const departamentosRouter = Router()

departamentosRouter.get('/', requireAuth, listarDepartamentosConCoord)
departamentosRouter.get('/:id/miembros', requireAuth, requireRole(['ADMIN', 'RH']), getMiembros)
departamentosRouter.post('/', requireAuth, requireRole(['ADMIN']), crearDepartamento)
departamentosRouter.put('/:id', requireAuth, requireRole(['ADMIN']), actualizarDepartamento)
departamentosRouter.delete('/:id', requireAuth, requireRole(['ADMIN']), eliminarDepartamento)
departamentosRouter.put('/:id/coordinador', requireAuth, requireRole(['ADMIN']), asignarCoordinador)
departamentosRouter.delete('/:id/coordinador', requireAuth, requireRole(['ADMIN']), quitarCoordinador)
