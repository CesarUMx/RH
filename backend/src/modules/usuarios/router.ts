import { Router } from 'express'
import { 
  listarUsuarios, 
  crearUsuario, 
  actualizarUsuario, 
  eliminarUsuario, 
  listarRoles 
} from './controller'
import { requireAuth, requireRole } from '../../middlewares/auth'

export const usuariosRouter = Router()

// Rutas protegidas que requieren autenticación y rol ADMIN
// IMPORTANTE: La ruta /roles debe ir antes de las rutas con parámetros para evitar conflictos
usuariosRouter.get('/roles', requireAuth, requireRole(['ADMIN', 'RH']), listarRoles)

// Rutas CRUD de usuarios
usuariosRouter.get('/', requireAuth, requireRole(['ADMIN', 'RH']), listarUsuarios)
usuariosRouter.post('/', requireAuth, requireRole(['ADMIN']), crearUsuario)
usuariosRouter.put('/:id', requireAuth, requireRole(['ADMIN']), actualizarUsuario)
usuariosRouter.delete('/:id', requireAuth, requireRole(['ADMIN']), eliminarUsuario)
