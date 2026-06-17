import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth, requireRole } from '../../middlewares/auth'
import { subirContrato, listarContratos, eliminarContrato, misContratos, descargarContrato } from './controller'

// Asegurar que el directorio de contratos exista
const contratosDir = path.join(process.cwd(), 'uploads', 'contratos')
if (!fs.existsSync(contratosDir)) fs.mkdirSync(contratosDir, { recursive: true })

const storageContratos = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, contratosDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, 'contrato-' + uniqueSuffix + ext)
  },
})

const uploadContrato = multer({
  storage: storageContratos,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.pdf') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF para contratos.'))
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

export const contratosRouter = Router()

// ── RH / ADMIN ─────────────────────────────────────────────────────────────────
contratosRouter.post(
  '/',
  requireAuth,
  requireRole(['ADMIN', 'RH']),
  uploadContrato.single('archivo'),
  handleMulterError,
  subirContrato
)
contratosRouter.get('/', requireAuth, requireRole(['ADMIN', 'RH']), listarContratos)
contratosRouter.delete('/:id', requireAuth, requireRole(['ADMIN', 'RH']), eliminarContrato)

// ── EMPLEADO ────────────────────────────────────────────────────────────────────
contratosRouter.get('/mis-contratos', requireAuth, requireRole(['EMPLEADO']), misContratos)
contratosRouter.get('/:id/descargar', requireAuth, requireRole(['EMPLEADO']), descargarContrato)
