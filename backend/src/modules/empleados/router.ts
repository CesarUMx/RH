import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  sugerirCorreo,
  crearEmpleado,
  listarEmpleados,
  exportarEmpleados,
  descargarCredenciales,
  misCredenciales,
  tieneCredenciales,
  plantillaImportar,
  importarEmpleados,
  darDeBaja,
  miNacionalidad,
  actualizarNacionalidad,
  actualizarEmpleado,
} from './controller'

export const empleadosRouter = Router()

const rhAdmin = ['ADMIN', 'RH']

// Rutas específicas antes que las de parámetro
empleadosRouter.post('/sugerir-correo',         requireAuth, requireRole(rhAdmin), sugerirCorreo)
empleadosRouter.get('/mis-credenciales/existe', requireAuth, tieneCredenciales)
empleadosRouter.patch('/mi-extranjero',         requireAuth, miNacionalidad)
empleadosRouter.get('/mis-credenciales',        requireAuth, misCredenciales)
empleadosRouter.get('/exportar',                requireAuth, requireRole(rhAdmin), exportarEmpleados)
empleadosRouter.get('/plantilla-importar',      requireAuth, requireRole(rhAdmin), plantillaImportar)
empleadosRouter.post('/importar',               requireAuth, requireRole(rhAdmin), upload.single('archivo'), importarEmpleados)

empleadosRouter.get('/',    requireAuth, requireRole(rhAdmin), listarEmpleados)
empleadosRouter.post('/',   requireAuth, requireRole(rhAdmin), crearEmpleado)
empleadosRouter.delete('/:userId',           requireAuth, requireRole(rhAdmin), darDeBaja)
empleadosRouter.get('/:userId/credenciales', requireAuth, requireRole(rhAdmin), descargarCredenciales)
empleadosRouter.patch('/:userId/extranjero', requireAuth, requireRole(rhAdmin), actualizarNacionalidad)
empleadosRouter.patch('/:userId',            requireAuth, requireRole(rhAdmin), actualizarEmpleado)