import { Router } from 'express'
import { requireApiKey } from '../../middlewares/apiKey'
import { rateLimit } from '../../middlewares/rateLimit'
import { buscarEmpleado } from './controller'

export const integracionRouter = Router()

// Aplicar rate limiting a todas las rutas de integración
integracionRouter.use(rateLimit)

// GET /api/v1/integracion/buscar-empleado
// Busca empleados por nombre, correo o número de colaborador
integracionRouter.get('/buscar-empleado', requireApiKey, buscarEmpleado)
