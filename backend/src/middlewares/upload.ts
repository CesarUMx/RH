import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Asegurar que el directorio de uploads exista
const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, file.fieldname + '-' + uniqueSuffix + ext)
  }
})

// Filtro para archivos permitidos
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Verificar si la ruta incluye 'solicitudes' o 'documentos' para permitir PDF e imágenes
  if (req.path.includes('solicitud') || req.path.includes('documento')) {
    const documentExtensions = ['.pdf', '.jpg', '.jpeg', '.png']
    const ext = path.extname(file.originalname).toLowerCase()
    
    if (documentExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF, JPG, JPEG y PNG para documentos.'))
    }
  } else {
    // Para otras rutas (como importación), permitir solo archivos CSV/Excel
    const dataExtensions = ['.csv', '.xlsx', '.xls']
    const ext = path.extname(file.originalname).toLowerCase()
    
    if (dataExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Formato de archivo no soportado. Use CSV o XLSX.'))
    }
  }
}

// Configuración de límites
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB
  files: 1
}

// Exportar middleware configurado
export const upload = multer({
  storage,
  fileFilter,
  limits
})
