import { Router } from 'express'
import { 
  listarDocentes,
  crearDocente,
  actualizarDocente,
  eliminarDocente,
  importarDocentes
} from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'

export const docentesRouter = Router()

// Rutas protegidas que requieren autenticación y rol ADMIN o RH
docentesRouter.get('/', requireAuth, requireRole(['ADMIN', 'RH']), listarDocentes)
docentesRouter.post('/', requireAuth, requireRole(['ADMIN', 'RH']), crearDocente)
docentesRouter.put('/:id', requireAuth, requireRole(['ADMIN', 'RH']), actualizarDocente)
docentesRouter.delete('/:id', requireAuth, requireRole(['ADMIN', 'RH']), eliminarDocente)

// Ruta para importación masiva
docentesRouter.post(
  '/import', 
  requireAuth, 
  requireRole(['ADMIN', 'RH']), 
  upload.single('file'), 
  importarDocentes
)
