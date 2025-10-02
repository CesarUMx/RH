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
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls']
  const ext = path.extname(file.originalname).toLowerCase()
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Formato de archivo no soportado. Use CSV o XLSX.'))
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
