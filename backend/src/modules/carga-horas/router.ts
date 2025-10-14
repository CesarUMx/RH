import { Router } from 'express'
import { generarPlantilla, procesarArchivo, confirmarCarga, procesarIndividual, obtenerCargas, deleteCargaHora, upload } from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'

export const cargaHorasRouter = Router()

// Ruta para generar plantilla de carga de horas
cargaHorasRouter.get('/plantillas', requireAuth, requireRole(['ADMIN', 'RH', 'COORD']), generarPlantilla)

// Ruta para procesar archivo de carga de horas
cargaHorasRouter.post('/procesar', requireAuth, requireRole(['COORD']), upload.single('archivo'), procesarArchivo)

// Ruta para confirmar carga de horas
cargaHorasRouter.post('/confirmar', requireAuth, requireRole(['COORD']), confirmarCarga)

// Ruta para procesar carga individual de horas
cargaHorasRouter.post('/procesar-individual', requireAuth, requireRole(['COORD']), procesarIndividual)

// Ruta para eliminar una carga de horas
cargaHorasRouter.delete('/:id', requireAuth, requireRole(['COORD']), deleteCargaHora)

// Ruta para obtener cargas de horas
cargaHorasRouter.get('/', requireAuth, requireRole(['ADMIN', 'RH', 'COORD']), obtenerCargas)
