import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth'
import { sugerirCorreo, crearCuenta, listarCuentas, obtenerCuenta, suspenderCuenta, activarCuenta } from './controller'

export const cuentasRouter = Router()

const roles = ['ADMIN', 'RH']

// Rutas específicas antes que las de parámetro
cuentasRouter.post('/sugerir', requireAuth, requireRole(roles), sugerirCorreo)

cuentasRouter.get('/', requireAuth, requireRole(roles), listarCuentas)
cuentasRouter.post('/', requireAuth, requireRole(roles), crearCuenta)
cuentasRouter.get('/:id', requireAuth, requireRole(roles), obtenerCuenta)
cuentasRouter.patch('/:id/suspender', requireAuth, requireRole(roles), suspenderCuenta)
cuentasRouter.patch('/:id/activar', requireAuth, requireRole(roles), activarCuenta)
