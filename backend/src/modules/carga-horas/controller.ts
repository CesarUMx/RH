import { Request, Response } from 'express'
import { PrismaClient, EstadoPeriodo } from '@prisma/client'
import { JwtPayload } from '../../middlewares/auth'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import multer from 'multer'
import { z } from 'zod'

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().getTime()
    const originalName = file.originalname
    const ext = path.extname(originalName)
    const fileName = `carga_horas_${timestamp}${ext}`
    cb(null, fileName)
  }
})

export const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Aceptar solo archivos Excel o CSV
    const allowedExtensions = ['.xlsx', '.xls', '.csv']
    const ext = path.extname(file.originalname).toLowerCase()
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de archivo no soportado. Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)'))
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
})

const prisma = new PrismaClient()

/**
 * GET /plantillas - Genera una plantilla para carga de horas
 * 
 * Query params:
 * - periodoId: ID del periodo (debe estar ABIERTO)
 * - areaId: ID del área (el usuario debe ser coordinador)
 * 
 * Genera un archivo XLSX con los docentes y columnas para la carga de horas
 */
export async function generarPlantilla(req: Request, res: Response) {
  try {
    // Obtener usuario autenticado
    const user = req.user as JwtPayload
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Verificar que el usuario tenga roles permitidos
    const rolesPermitidos = ['ADMIN', 'RH', 'COORD'];
    const tieneRolPermitido = user.roles.some(rol => rolesPermitidos.includes(rol));
    
    if (!tieneRolPermitido) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'No tienes permisos para descargar plantillas' 
      })
    }

    // Validar parámetros
    const { periodoId, areaId } = req.query
    
    if (!periodoId || !areaId) {
      return res.status(400).json({ 
        error: 'Parámetros incompletos', 
        mensaje: 'Se requieren periodoId y areaId' 
      })
    }
    
    const periodoIdNum = parseInt(periodoId as string)
    const areaIdNum = parseInt(areaId as string)
    
    if (isNaN(periodoIdNum) || isNaN(areaIdNum)) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        mensaje: 'periodoId y areaId deben ser números' 
      })
    }

    // Verificar que el periodo exista y esté ABIERTO
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoIdNum }
    })
    
    if (!periodo) {
      return res.status(404).json({ 
        error: 'Periodo no encontrado', 
        mensaje: `No existe un periodo con ID ${periodoIdNum}` 
      })
    }
    
    if (periodo.estado !== EstadoPeriodo.ABIERTO) {
      return res.status(403).json({ 
        error: 'Periodo no disponible', 
        mensaje: `El periodo debe estar en estado ABIERTO, estado actual: ${periodo.estado}` 
      })
    }

    // Verificar que el área exista
    const area = await prisma.area.findUnique({
      where: { id: areaIdNum }
    })
    
    if (!area) {
      return res.status(404).json({ 
        error: 'Área no encontrada', 
        mensaje: `No existe un área con ID ${areaIdNum}` 
      })
    }

    // Si el usuario es COORD, verificar que sea coordinador del área
    // Los usuarios ADMIN y RH pueden acceder a cualquier área
    if (user.roles.includes('COORD') && !user.roles.includes('ADMIN') && !user.roles.includes('RH')) {
      const coordArea = await prisma.coordArea.findFirst({
        where: {
          userId: user.id,
          areaId: areaIdNum
        }
      })
      
      if (!coordArea) {
        return res.status(403).json({ 
          error: 'Acceso denegado', 
          mensaje: 'No eres coordinador de esta área' 
        })
      }
    }

    // Obtener los docentes activos
    const docentes = await prisma.docente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    })

    // Crear la plantilla
    const workbook = XLSX.utils.book_new()
    
    // Datos para la hoja de cálculo
    let data = [];
    
    // Si no hay docentes, agregar al menos una fila de ejemplo
    if (docentes.length === 0) {
      data = [{
        codigo_interno: 'EJEMPLO',
        nombre: 'DOCENTE EJEMPLO',
        rfc: 'XAXX010101000',
        materia: 'MATERIA EJEMPLO',
        horas: '10',
        costo_hora: '100',
        pagable: '1'
      }];
    } else {
      data = docentes.map(docente => ({
        codigo_interno: docente.codigoInterno,
        nombre: docente.nombre,
        rfc: docente.rfc,
        materia: '', // Campo a completar por el usuario
        horas: '', // Campo a completar por el usuario
        costo_hora: '', // Campo a completar por el usuario
        pagable: '1' // Por defecto es pagable (1)
      }));
    }
    
    // Crear la hoja de cálculo con encabezados
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: ['codigo_interno', 'nombre', 'rfc', 'materia', 'horas', 'costo_hora', 'pagable'],
      skipHeader: false
    })
    
    // Establecer encabezados más descriptivos
    const headers = [
      { v: 'Código Interno', t: 's' },
      { v: 'Nombre del Docente', t: 's' },
      { v: 'RFC', t: 's' },
      { v: 'Materia', t: 's' },
      { v: 'Horas', t: 's' },
      { v: 'Costo por Hora', t: 's' },
      { v: 'Pagable (1=Sí, 0=No)', t: 's' }
    ];
    
    // Reemplazar encabezados
    XLSX.utils.sheet_add_aoa(worksheet, [headers.map(h => h.v)], { origin: 'A1' });
    
    // Ajustar ancho de columnas
    const wscols = [
      { wch: 15 }, // Código Interno
      { wch: 30 }, // Nombre del Docente
      { wch: 15 }, // RFC
      { wch: 40 }, // Materia
      { wch: 10 }, // Horas
      { wch: 15 }, // Costo por Hora
      { wch: 20 }  // Pagable
    ];
    worksheet['!cols'] = wscols;
    
    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Carga Horas')
    
    // Crear directorio temporal si no existe
    const uploadsDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    
    // Generar nombre de archivo único
    const timestamp = new Date().getTime()
    const fileName = `plantilla_carga_${area.nombre}_${periodo.nombre}_${timestamp}.xlsx`
    const filePath = path.join(uploadsDir, fileName)
    
    // Escribir el archivo
    try {
      XLSX.writeFile(workbook, filePath)
      console.log(`Archivo Excel creado correctamente en: ${filePath}`)
      
      // Verificar que el archivo existe antes de enviarlo
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        console.log(`Tamaño del archivo: ${stats.size} bytes`)
        
        if (stats.size === 0) {
          throw new Error('El archivo generado está vacío')
        }
        
        // Establecer encabezados para la descarga
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
        res.setHeader('Content-Length', stats.size)
        
        // Enviar el archivo como respuesta
        const fileStream = fs.createReadStream(filePath)
        fileStream.pipe(res)
        
        // Eliminar el archivo después de enviarlo
        fileStream.on('end', () => {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error al eliminar el archivo temporal:', unlinkErr)
            } else {
              console.log(`Archivo temporal eliminado: ${filePath}`)
            }
          })
        })
      } else {
        throw new Error('El archivo no se creó correctamente')
      }
    } catch (error) {
      console.error('Error al generar o enviar el archivo Excel:', error)
      return res.status(500).json({
        error: 'Error al generar plantilla',
        mensaje: 'No se pudo generar el archivo Excel'
      })
    }
  } catch (error) {
    console.error('Error al generar plantilla:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al generar la plantilla' 
    })
  }
}

/**
 * POST /procesar - Procesa un archivo de carga de horas
 * 
 * Body (multipart/form-data):
 * - archivo: Archivo Excel o CSV con los datos de carga de horas
 * - periodoId: ID del periodo
 * - areaId: ID del área
 * 
 * Devuelve los datos procesados para vista previa
 */
export async function procesarArchivo(req: Request, res: Response) {
  try {
    // Obtener usuario autenticado
    const user = req.user as JwtPayload
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Verificar que el usuario tenga rol COORD
    if (!user.roles.includes('COORD')) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'Solo los coordinadores pueden procesar archivos de carga de horas' 
      })
    }

    // Validar parámetros
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Archivo no proporcionado', 
        mensaje: 'Debe proporcionar un archivo para procesar' 
      })
    }

    const { periodoId, areaId } = req.body
    
    if (!periodoId || !areaId) {
      return res.status(400).json({ 
        error: 'Parámetros incompletos', 
        mensaje: 'Se requieren periodoId y areaId' 
      })
    }
    
    const periodoIdNum = parseInt(periodoId)
    const areaIdNum = parseInt(areaId)
    
    if (isNaN(periodoIdNum) || isNaN(areaIdNum)) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        mensaje: 'periodoId y areaId deben ser números' 
      })
    }

    // Verificar que el periodo exista y esté ABIERTO
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoIdNum }
    })
    
    if (!periodo) {
      return res.status(404).json({ 
        error: 'Periodo no encontrado', 
        mensaje: `No existe un periodo con ID ${periodoIdNum}` 
      })
    }
    
    if (periodo.estado !== EstadoPeriodo.ABIERTO) {
      return res.status(403).json({ 
        error: 'Periodo no disponible', 
        mensaje: `El periodo debe estar en estado ABIERTO, estado actual: ${periodo.estado}` 
      })
    }

    // Verificar que el área exista
    const area = await prisma.area.findUnique({
      where: { id: areaIdNum }
    })
    
    if (!area) {
      return res.status(404).json({ 
        error: 'Área no encontrada', 
        mensaje: `No existe un área con ID ${areaIdNum}` 
      })
    }

    // Verificar que el usuario sea coordinador del área
    const coordArea = await prisma.coordArea.findFirst({
      where: {
        userId: user.id,
        areaId: areaIdNum
      }
    })
    
    if (!coordArea) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'No eres coordinador de esta área' 
      })
    }

    // Procesar el archivo
    const filePath = req.file.path
    const ext = path.extname(req.file.originalname).toLowerCase()
    
    let data: any[] = []
    let errores: { linea: number, mensaje: string }[] = []

    // Leer datos del archivo según su extensión
    if (ext === '.csv') {
      // Procesar CSV
      const fileContent = fs.readFileSync(filePath, 'utf8')
      const rows = fileContent.split('\n')
      
      if (rows.length > 0 && rows[0]) {
        // Obtener encabezados
        const headers = rows[0].split(',').map(h => h.trim())
        
        // Procesar filas
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || !row.trim()) continue // Saltar filas vacías
          
          const values = row.split(',').map(v => v.trim())
          const rowData: any = {}
          
          headers.forEach((header, index) => {
            rowData[header] = values[index] || ''
          })
          
          // Validar datos
          try {
            validateRowData(rowData, i + 1)
            data.push(rowData)
          } catch (error: any) {
            errores.push({ linea: i + 1, mensaje: error.message })
          }
        }
      }
    } else {
      // Procesar Excel
      const workbook = XLSX.readFile(filePath)
      if (workbook.SheetNames && workbook.SheetNames.length > 0) {
        const sheetName = workbook.SheetNames[0]
        const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined
        
        if (worksheet) {
          // Convertir a JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false })
          
          // Validar cada fila
          jsonData.forEach((row: any, index) => {
            try {
              validateRowData(row, index + 2) // +2 porque Excel empieza en 1 y hay encabezado
              data.push(row)
            } catch (error: any) {
              errores.push({ linea: index + 2, mensaje: error.message })
            }
          })
        }
      }
    }

    // Eliminar el archivo temporal
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error al eliminar archivo temporal:', err)
    })
    
    // Registrar en auditoría
    await prisma.auditoria.create({
      data: {
        userId: user.id,
        accion: 'PROCESAR_ARCHIVO_CARGA',
        entidad: 'CargaHoras',
        payload: {
          periodoId,
          areaId,
          registrosValidos: data.length,
          errores: errores.length,
          nombreArchivo: req.file.originalname,
          timestamp: new Date().toISOString()
        }
      }
    })

    // Devolver los datos procesados
    return res.json({
      datos: data,
      errores: errores.length > 0 ? errores : undefined
    })
  } catch (error) {
    console.error('Error al procesar archivo:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al procesar el archivo' 
    })
  }
}

/**
 * POST /confirmar - Confirma la carga de horas
 * 
 * Body:
 * - datos: Array con los datos de carga de horas
 * - periodoId: ID del periodo
 * - areaId: ID del área
 * 
 * Guarda los datos de carga de horas en la base de datos
 */
export async function confirmarCarga(req: Request, res: Response) {
  try {
    // Obtener usuario autenticado
    const user = req.user as JwtPayload
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Verificar que el usuario tenga rol COORD
    if (!user.roles.includes('COORD')) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'Solo los coordinadores pueden confirmar cargas de horas' 
      })
    }

    // Validar esquema de datos
    const confirmarSchema = z.object({
      datos: z.array(z.object({
        codigo_interno: z.string().min(1, 'Código interno requerido'),
        nombre: z.string(),
        rfc: z.string(),
        materia: z.string().min(1, 'Materia requerida'),
        horas: z.union([
          z.string().regex(/^\d+$/, 'Horas debe ser un número'),
          z.number().min(1, 'Horas debe ser mayor a 0')
        ]),
        costo_hora: z.union([
          z.string().regex(/^\d+(\.\d+)?$/, 'Costo por hora debe ser un número'),
          z.number().min(1, 'Costo por hora debe ser mayor a 0')
        ]),
        pagable: z.union([
          z.string().regex(/^[01]$/, 'Pagable debe ser 0 o 1'),
          z.number().min(0).max(1),
          z.boolean()
        ])
      })),
      periodoId: z.number(),
      areaId: z.number()
    })

    const validacion = confirmarSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { datos, periodoId, areaId } = validacion.data

    // Verificar que el periodo exista y esté ABIERTO
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId }
    })
    
    if (!periodo) {
      return res.status(404).json({ 
        error: 'Periodo no encontrado', 
        mensaje: `No existe un periodo con ID ${periodoId}` 
      })
    }
    
    if (periodo.estado !== EstadoPeriodo.ABIERTO) {
      return res.status(403).json({ 
        error: 'Periodo no disponible', 
        mensaje: `El periodo debe estar en estado ABIERTO, estado actual: ${periodo.estado}` 
      })
    }

    // Verificar que el área exista
    const area = await prisma.area.findUnique({
      where: { id: areaId }
    })
    
    if (!area) {
      return res.status(404).json({ 
        error: 'Área no encontrada', 
        mensaje: `No existe un área con ID ${areaId}` 
      })
    }

    // Verificar que el usuario sea coordinador del área
    const coordArea = await prisma.coordArea.findFirst({
      where: {
        userId: user.id,
        areaId
      }
    })
    
    if (!coordArea) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'No eres coordinador de esta área' 
      })
    }

    // Procesar cada registro
    let registrados = 0
    let errores = 0

    // Usar transacción para garantizar consistencia
    await prisma.$transaction(async (prisma) => {
      // Primero, obtener todos los docentes por código interno para validar
      const codigosInternos = datos.map(d => d.codigo_interno)
      const docentesExistentes = await prisma.docente.findMany({
        where: {
          codigoInterno: { in: codigosInternos }
        }
      })

      // Mapear docentes por código interno para acceso rápido
      const docentesPorCodigo = new Map()
      docentesExistentes.forEach(d => docentesPorCodigo.set(d.codigoInterno, d))
      
      // Verificar si hay cargas existentes para estos docentes en este periodo y área
      const cargasExistentes = await prisma.cargaHoras.findMany({
        where: {
          periodoId,
          areaId,
          docenteId: { in: docentesExistentes.map(d => d.id) }
        },
        select: {
          docenteId: true,
          materiaText: true,
          version: true
        }
      })
      
      // Mapear cargas existentes por docenteId y materiaText para acceso rápido
      const cargasExistentesMapa = new Map()
      cargasExistentes.forEach(c => {
        const key = `${c.docenteId}-${c.materiaText}`
        cargasExistentesMapa.set(key, c.version)
      })

      // Detectar duplicados en los datos de entrada
      const duplicadosMap = new Map()
      
      // Procesar cada registro
      for (const registro of datos) {
        const docente = docentesPorCodigo.get(registro.codigo_interno)
        
        if (!docente) {
          errores++
          continue
        }
        
        // Crear una clave única para este docente y materia
        const registroKey = `${docente.id}-${registro.materia}`
        
        // Verificar duplicados en el mismo lote de datos
        if (duplicadosMap.has(registroKey)) {
          // Encontramos un duplicado en el mismo lote
          errores++
          continue
        }
        
        // Marcar este registro como procesado para detectar duplicados
        duplicadosMap.set(registroKey, true)

        // Convertir valores a números
        const horas = typeof registro.horas === 'string' ? parseInt(registro.horas) : registro.horas
        const pagable = typeof registro.pagable === 'string' ? registro.pagable === '1' : !!registro.pagable
        
        // Si pagable es 0, el costo por hora debe ser 0 (importe = 0)
        let costoHora = typeof registro.costo_hora === 'string' ? parseFloat(registro.costo_hora) : registro.costo_hora
        if (!pagable) {
          costoHora = 0 // Forzar costo_hora a 0 cuando pagable es 0
        }

        // Verificar si ya existe una carga para este docente y materia
        const versionExistente = cargasExistentesMapa.get(registroKey)
        
        if (versionExistente !== undefined) {
          // Actualizar registro existente incrementando la versión
          await prisma.cargaHoras.updateMany({
            where: {
              docenteId: docente.id,
              periodoId,
              areaId,
              materiaText: registro.materia
            },
            data: {
              horas: horas,
              costoHora: costoHora,
              pagable: pagable,
              version: { increment: 1 },
              creadoPorId: user.id
            }
          })
        } else {
          // Crear nuevo registro de carga
          await prisma.cargaHoras.create({
            data: {
              docenteId: docente.id,
              periodoId,
              areaId,
              materiaText: registro.materia,
              horas: horas,
              costoHora: costoHora,
              pagable: pagable,
              creadoPorId: user.id
            }
          })
        }

        registrados++
      }
    })

    // Registrar en auditoría
    await prisma.auditoria.create({
      data: {
        userId: user.id,
        accion: 'CARGA_HORAS',
        entidad: 'CargaHoras',
        payload: {
          periodoId,
          areaId,
          registrados,
          errores,
          timestamp: new Date().toISOString()
        }
      }
    })
    
    // Devolver resultado
    return res.json({
      registrados,
      errores,
      mensaje: `Se registraron ${registrados} cargas de horas correctamente. ${errores > 0 ? `Hubo ${errores} errores.` : ''}`
    })
  } catch (error) {
    console.error('Error al confirmar carga:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al confirmar la carga de horas' 
    })
  }
}

// Función auxiliar para validar los datos de una fila
function validateRowData(row: any, lineNumber: number) {
  // Validar campos requeridos
  if (!row.codigo_interno) {
    throw new Error(`Falta el código interno`)
  }
  
  if (!row.materia) {
    throw new Error(`Falta la materia`)
  }
  
  // Validar horas
  const horas = row.horas !== undefined ? row.horas : ''
  if (!horas || isNaN(Number(horas)) || Number(horas) <= 0) {
    throw new Error(`Las horas deben ser un número mayor a 0`)
  }
  
  // Validar costo por hora
  const costoHora = row.costo_hora !== undefined ? row.costo_hora : ''
  if (!costoHora || isNaN(Number(costoHora)) || Number(costoHora) <= 0) {
    throw new Error(`El costo por hora debe ser un número mayor a 0`)
  }
  
  // Validar pagable (0 o 1)
  const pagable = row.pagable !== undefined ? row.pagable : ''
  if (pagable !== '0' && pagable !== '1' && pagable !== 0 && pagable !== 1) {
    throw new Error(`Pagable debe ser 0 o 1`)
  }
}
