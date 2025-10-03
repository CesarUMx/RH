import { Router } from 'express'
import { 
  listarPeriodos,
  crearPeriodo,
  abrirPeriodo,
  cerrarPeriodo,
  reportarPeriodo
} from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'

export const periodosRouter = Router()

// Rutas públicas (con autenticación)
periodosRouter.get('/', requireAuth, listarPeriodos)

// Rutas protegidas que requieren rol RH
periodosRouter.post('/', requireAuth, requireRole(['ADMIN', 'RH']), crearPeriodo)
periodosRouter.patch('/:id/abrir', requireAuth, requireRole(['ADMIN', 'RH']), abrirPeriodo)
periodosRouter.patch('/:id/cerrar', requireAuth, requireRole(['ADMIN', 'RH']), cerrarPeriodo)
periodosRouter.patch('/:id/reportar', requireAuth, requireRole(['ADMIN', 'RH']), reportarPeriodo)
