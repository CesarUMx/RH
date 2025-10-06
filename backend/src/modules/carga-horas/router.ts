import { Router } from 'express'
import { generarPlantilla, procesarArchivo, confirmarCarga, upload } from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'

export const cargaHorasRouter = Router()

// Ruta para generar plantilla de carga de horas
cargaHorasRouter.get('/plantillas', requireAuth, requireRole(['ADMIN', 'RH', 'COORD']), generarPlantilla)

// Ruta para procesar archivo de carga de horas
cargaHorasRouter.post('/procesar', requireAuth, requireRole(['COORD']), upload.single('archivo'), procesarArchivo)

// Ruta para confirmar carga de horas
cargaHorasRouter.post('/confirmar', requireAuth, requireRole(['COORD']), confirmarCarga)
