import { Router } from 'express'
import { 
  listarDocentes,
  crearDocente,
  actualizarDocente,
  eliminarDocente,
  importarDocentes,
  descargarPlantilla
} from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'
import { requireAreaPermission } from '../../middlewares/areaPermissions'
import { upload } from '../../middlewares/upload'

export const docentesRouter = Router()

// Rutas protegidas que requieren autenticación
// COORD puede listar docentes, pero solo de sus áreas asignadas
docentesRouter.get('/', requireAuth, requireRole(['ADMIN', 'RH', 'COORD']), listarDocentes)

// Rutas solo para ADMIN y RH
docentesRouter.post('/', requireAuth, requireRole(['ADMIN', 'RH']), crearDocente)
docentesRouter.put('/:id', requireAuth, requireRole(['ADMIN', 'RH']), actualizarDocente)
docentesRouter.delete('/:id', requireAuth, requireRole(['ADMIN', 'RH']), eliminarDocente)

// Ruta para descargar plantilla
docentesRouter.get(
  '/plantilla',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  descargarPlantilla
)

// Ruta para importación masiva
docentesRouter.post(
  '/import', 
  requireAuth, 
  requireRole(['ADMIN', 'RH']), 
  upload.single('file'), 
  importarDocentes
)
