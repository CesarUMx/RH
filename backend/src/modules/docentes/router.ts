import { Router } from 'express'
import { 
  listarDocentes,
  buscarDocente,
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

// IMPORTANTE: Las rutas específicas deben ir ANTES de las rutas genéricas

// Ruta para descargar plantilla (debe ir antes de /buscar para evitar conflictos)
docentesRouter.get(
  '/plantilla',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  descargarPlantilla
)

// Ruta para buscar un docente específico por código o RFC
docentesRouter.get('/buscar', requireAuth, requireRole(['ADMIN', 'RH', 'COORD']), buscarDocente)

// Rutas protegidas que requieren autenticación
// COORD puede listar docentes, pero solo de sus áreas asignadas
docentesRouter.get('/', requireAuth, requireRole(['ADMIN', 'RH', 'COORD']), listarDocentes)

// Rutas solo para ADMIN y RH
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
