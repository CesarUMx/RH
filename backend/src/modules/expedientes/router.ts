import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  listarSecciones,
  crearSeccion,
  actualizarSeccion,
  eliminarSeccion,
  listarTipos,
  crearTipo,
  actualizarTipo,
  eliminarTipo,
  miExpediente,
  subirDocumento,
  listarExpedientes,
  obtenerExpedienteEmpleado,
  verificarDocumento,
  revertirDocumento,
} from './controller'

// Asegurar que el directorio de expedientes exista
const expedientesDir = path.join(process.cwd(), 'uploads', 'expedientes')
if (!fs.existsSync(expedientesDir)) fs.mkdirSync(expedientesDir, { recursive: true })

// Configuración de almacenamiento específica para expedientes
const storageExpedientes = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, expedientesDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, 'expediente-' + uniqueSuffix + ext)
  },
})

const uploadExpediente = multer({
  storage: storageExpedientes,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.pdf') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF para expedientes.'))
    }
  },
})

const handleMulterError = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo de 10MB' })
    }
    return res.status(400).json({ error: `Error al subir archivo: ${err.message}` })
  } else if (err) {
    return res.status(400).json({ error: err.message || 'Error al subir archivo' })
  }
  next()
}

export const expedientesRouter = Router()

// ── ADMIN: Secciones ──────────────────────────────────────────────────────────
expedientesRouter.get('/secciones', requireAuth, requireRole(['ADMIN', 'RH', 'EMPLEADO']), listarSecciones)
expedientesRouter.post('/secciones', requireAuth, requireRole(['ADMIN']), crearSeccion)
expedientesRouter.put('/secciones/:id', requireAuth, requireRole(['ADMIN']), actualizarSeccion)
expedientesRouter.delete('/secciones/:id', requireAuth, requireRole(['ADMIN']), eliminarSeccion)

// ── ADMIN: Tipos de documento ──────────────────────────────────────────────────
expedientesRouter.get('/tipos', requireAuth, requireRole(['ADMIN', 'RH', 'EMPLEADO']), listarTipos)
expedientesRouter.post('/tipos', requireAuth, requireRole(['ADMIN']), crearTipo)
expedientesRouter.put('/tipos/:id', requireAuth, requireRole(['ADMIN']), actualizarTipo)
expedientesRouter.delete('/tipos/:id', requireAuth, requireRole(['ADMIN']), eliminarTipo)

// ── EMPLEADO: Mi expediente ────────────────────────────────────────────────────
expedientesRouter.get('/mi-expediente', requireAuth, requireRole(['EMPLEADO']), miExpediente)
expedientesRouter.post(
  '/documentos',
  requireAuth,
  requireRole(['EMPLEADO']),
  uploadExpediente.single('archivo'),
  handleMulterError,
  subirDocumento
)

// ── RH / ADMIN: Validación ─────────────────────────────────────────────────────
expedientesRouter.get('/', requireAuth, requireRole(['ADMIN', 'RH']), listarExpedientes)
expedientesRouter.get('/:empleadoId', requireAuth, requireRole(['ADMIN', 'RH']), obtenerExpedienteEmpleado)
expedientesRouter.patch('/documentos/:id/verificar', requireAuth, requireRole(['ADMIN', 'RH']), verificarDocumento)
expedientesRouter.patch('/documentos/:id/revertir', requireAuth, requireRole(['ADMIN']), revertirDocumento)
