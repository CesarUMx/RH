import { Request, Response } from 'express'
import { PrismaClient, EstadoPeriodo } from '@prisma/client'
import { JwtPayload } from '../../middlewares/auth'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import multer from 'multer'
import { z } from 'zod'

// Definir la interfaz para el mapeo de campos
interface FieldMapping {
  internal: string;
  display: string;
}

// Extender el objeto global para incluir fieldMapping
declare global {
  var fieldMapping: FieldMapping[];
}

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
    
    // Definir los nombres de campo internos y sus encabezados descriptivos
    const fieldMapping = [
      { internal: 'codigo_interno', display: 'Código Interno' },
      { internal: 'nombre', display: 'Nombre del Docente' },
      { internal: 'rfc', display: 'RFC' },
      { internal: 'materia', display: 'Materia' },
      { internal: 'horas', display: 'Horas' },
      { internal: 'costo_hora', display: 'Costo por Hora' },
      { internal: 'pagable', display: 'Pagable (1=Sí, 0=No)' }
    ];
    
    // Guardar el mapeo en una variable global para usarlo en el procesamiento
    global.fieldMapping = fieldMapping as FieldMapping[];
    
    // Crear la hoja de cálculo con encabezados internos
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: fieldMapping.map(f => f.internal),
      skipHeader: false
    })
    
    // Establecer encabezados descriptivos
    const headers = fieldMapping.map(f => ({ v: f.display, t: 's' }));
    
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
      
      // Verificar que el archivo existe antes de enviarlo
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        
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
          // Usar los mismos nombres de campo que se usaron al generar la plantilla
          const fieldMapping: FieldMapping[] = global.fieldMapping || [
            { internal: 'codigo_interno', display: 'Código Interno' },
            { internal: 'nombre', display: 'Nombre del Docente' },
            { internal: 'rfc', display: 'RFC' },
            { internal: 'materia', display: 'Materia' },
            { internal: 'horas', display: 'Horas' },
            { internal: 'costo_hora', display: 'Costo por Hora' },
            { internal: 'pagable', display: 'Pagable (1=Sí, 0=No)' }
          ];
          
          // Convertir a JSON usando los encabezados descriptivos
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            defval: '', // Valor por defecto para celdas vacías
            header: fieldMapping.map((f: FieldMapping) => f.display), // Usar encabezados descriptivos
            range: 1 // Comenzar desde la segunda fila (saltar encabezados)
          });
                    
          // Crear un mapa de encabezados descriptivos a nombres de campo internos
          const headerMap: {[key: string]: string} = {};
          fieldMapping.forEach((f: FieldMapping) => {
            headerMap[f.display] = f.internal;
          });
          
          // Validar cada fila
          jsonData.forEach((rawRow: any, index) => {
            try {
              // Convertir fila con encabezados descriptivos a nombres de campo internos
              const row: any = {};
              
              // Procesar cada campo usando el mapeo de encabezados
              Object.entries(rawRow).forEach(([key, value]) => {
                // Buscar el nombre de campo interno correspondiente
                const internalField = headerMap[key];
                if (internalField) {
                  // Convertir valores numéricos directamente
                  if (internalField === 'horas' || internalField === 'costo_hora') {
                    // Intentar convertir a número
                    const numValue = Number(value);
                    row[internalField] = isNaN(numValue) ? value : numValue;
                  } else {
                    row[internalField] = value;
                  }
                } else {
                  // Si no hay mapeo, usar el nombre original
                  row[key] = value;
                }
              });
              
              // Asegurar que todos los campos internos existan
              fieldMapping.forEach((f: FieldMapping) => {
                if (row[f.internal] === undefined) {
                  row[f.internal] = '';
                }
              });
              
              // Verificar si la fila tiene materia - si no, ignorarla silenciosamente
              if (!row.materia || row.materia.toString().trim() === '') {
                // Ignorar esta fila sin reportar error
                return;
              }
              
              // Solo mostrar logs para las primeras filas
              if (index < 2) {
                console.log(`Procesando fila ${index + 2}:`, 
                  `Código: ${row.codigo_interno}, ` +
                  `Materia: ${row.materia}, ` +
                  `Horas: ${row.horas} (${typeof row.horas}), ` +
                  `Costo: ${row.costo_hora} (${typeof row.costo_hora})`);
              }
              
              // Forzar conversión de valores numéricos para todas las filas
              if (row.horas) row.horas = Number(String(row.horas).replace(/\s+/g, ''));
              if (row.costo_hora) row.costo_hora = Number(String(row.costo_hora).replace(/\s+/g, ''));
              
              validateRowData(row, index + 2) // +2 porque Excel empieza en 1 y hay encabezado
              data.push(row)
            } catch (error: any) {
              console.error(`Error en fila ${index + 2}:`, error.message);
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

/**
 * GET / - Obtiene las cargas de horas registradas
 * 
 * Query params:
 * - periodoId: ID del periodo
 * - areaId: ID del área
 * - page: Número de página (default: 1)
 * - pageSize: Tamaño de página (default: 10)
 * - query: Consulta de búsqueda (opcional)
 * 
 * Devuelve una lista paginada de cargas de horas
 */
export async function obtenerCargas(req: Request, res: Response) {
  try {
    // Obtener usuario autenticado
    const user = req.user as JwtPayload;
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener parámetros de consulta
    const periodoId = Number(req.query.periodoId);
    const areaId = Number(req.query.areaId);
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const query = (req.query.query as string) || '';

    // Validar parámetros requeridos
    if (!periodoId || isNaN(periodoId)) {
      return res.status(400).json({ error: 'El ID del periodo es requerido y debe ser un número' });
    }

    if (!areaId || isNaN(areaId)) {
      return res.status(400).json({ error: 'El ID del área es requerido y debe ser un número' });
    }

    // Verificar que el periodo exista
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId }
    });

    if (!periodo) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    // Verificar que el área exista
    const area = await prisma.area.findUnique({
      where: { id: areaId }
    });

    if (!area) {
      return res.status(404).json({ error: 'Área no encontrada' });
    }

    // Si el usuario no es ADMIN o RH, verificar que sea coordinador del área
    if (!user.roles.includes('ADMIN') && !user.roles.includes('RH')) {
      const coordArea = await prisma.coordArea.findFirst({
        where: {
          userId: user.id,
          areaId
        }
      });

      if (!coordArea) {
        return res.status(403).json({ error: 'No tienes permiso para ver las cargas de esta área' });
      }
    }

    // Calcular el offset para la paginación
    const skip = (page - 1) * pageSize;

    // Construir la condición de búsqueda
    const whereCondition: any = {
      periodoId,
      areaId
    };

    // Si hay una consulta de búsqueda, buscar por nombre de docente o materia
    if (query) {
      whereCondition.OR = [
        {
          docente: {
            nombre: {
              contains: query,
              mode: 'insensitive'
            }
          }
        },
        {
          materiaText: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Obtener el total de registros
    const total = await prisma.cargaHoras.count({
      where: whereCondition
    });

    // Calcular el total de páginas
    const totalPages = Math.ceil(total / pageSize);

    // Obtener los registros paginados
    const cargas = await prisma.cargaHoras.findMany({
      where: whereCondition,
      include: {
        docente: {
          select: {
            id: true,
            codigoInterno: true,
            nombre: true,
            rfc: true
          }
        }
      },
      orderBy: [
        { docente: { nombre: 'asc' } },
        { materiaText: 'asc' }
      ],
      skip,
      take: pageSize
    });

    // Devolver los resultados
    return res.json({
      data: cargas,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error al obtener cargas de horas:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * POST /procesar-individual - Procesa una carga individual de horas
 * 
 * Body:
 * - dato: Objeto con los datos de la carga individual
 * - periodoId: ID del periodo
 * - areaId: ID del área
 * 
 * Valida los datos y devuelve la vista previa para confirmar
 */
export async function procesarIndividual(req: Request, res: Response) {
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
        mensaje: 'Solo los coordinadores pueden procesar cargas de horas' 
      })
    }

    // Validar esquema de datos
    const procesarIndividualSchema = z.object({
      dato: z.object({
        codigo_interno: z.string().min(1, 'Código interno requerido'),
        nombre: z.string().min(1, 'Nombre requerido'),
        rfc: z.string().min(1, 'RFC requerido'),
        materia: z.string().min(1, 'Materia requerida'),
        horas: z.union([
          z.string().regex(/^\d+$/, 'Horas debe ser un número'),
          z.number().min(1, 'Horas debe ser mayor a 0')
        ]),
        costo_hora: z.union([
          z.string().regex(/^\d+(\.\d+)?$/, 'Costo por hora debe ser un número'),
          z.number().min(0, 'Costo por hora no puede ser negativo')
        ]),
        pagable: z.union([
          z.string().regex(/^[01]$/, 'Pagable debe ser 0 o 1'),
          z.number().min(0).max(1),
          z.boolean()
        ])
      }),
      periodoId: z.number(),
      areaId: z.number()
    })

    const validacion = procesarIndividualSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { dato, periodoId, areaId } = validacion.data

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

    // Buscar el docente por código interno
    const docente = await prisma.docente.findUnique({
      where: { codigoInterno: dato.codigo_interno }
    })

    if (!docente) {
      return res.status(404).json({ 
        error: 'Docente no encontrado', 
        mensaje: `No existe un docente con código interno ${dato.codigo_interno}` 
      })
    }

    // Verificar que el RFC coincida con el docente
    if (docente.rfc !== dato.rfc) {
      return res.status(400).json({ 
        error: 'RFC no coincide', 
        mensaje: `El RFC proporcionado no coincide con el docente de código interno ${dato.codigo_interno}` 
      })
    }

    // Verificar que el nombre coincida con el docente (puede haber variaciones menores)
    if (docente.nombre.toLowerCase() !== dato.nombre.toLowerCase()) {
      // Solo advertir, no bloquear
      console.warn(`Advertencia: El nombre proporcionado (${dato.nombre}) no coincide exactamente con el docente (${docente.nombre})`)
    }

    // Validar los datos
    try {
      validateRowData(dato, 1)
    } catch (error: any) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        mensaje: error.message 
      })
    }

    // Convertir valores a números
    const horas = typeof dato.horas === 'string' ? parseInt(dato.horas) : dato.horas
    const costoHora = typeof dato.costo_hora === 'string' ? parseFloat(dato.costo_hora) : dato.costo_hora
    const pagable = typeof dato.pagable === 'string' ? dato.pagable === '1' : !!dato.pagable

    // Verificar si ya existe una carga para este docente, materia, periodo y área
    const cargaExistente = await prisma.cargaHoras.findFirst({
      where: {
        docenteId: docente.id,
        periodoId,
        areaId,
        materiaText: dato.materia
      }
    })

    // Preparar datos para la vista previa
    const datosProcesados = [{
      codigo_interno: docente.codigoInterno,
      nombre: docente.nombre,
      rfc: docente.rfc,
      materia: dato.materia,
      horas: horas,
      costo_hora: costoHora,
      pagable: pagable ? 1 : 0,
      importe: horas * costoHora,
      existe: !!cargaExistente
    }]

    // Registrar en auditoría
    await prisma.auditoria.create({
      data: {
        userId: user.id,
        accion: 'PROCESAR_INDIVIDUAL_CARGA',
        entidad: 'CargaHoras',
        payload: {
          periodoId,
          areaId,
          docenteId: docente.id,
          materia: dato.materia,
          timestamp: new Date().toISOString()
        }
      }
    })

    // Devolver los datos procesados
    return res.json({
      datos: datosProcesados,
      errores: undefined
    })
  } catch (error) {
    console.error('Error al procesar carga individual:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al procesar la carga individual' 
    })
  }
}

// Función auxiliar para validar los datos de una fila
function validateRowData(row: any, lineNumber: number) {
  // Validar campos requeridos
  if (!row.codigo_interno) {
    throw new Error(`Falta el código interno`)
  }
  
  // Ya no validamos materia aquí, se filtra antes
  
  // Validar horas - Simplificado
  let horas = row.horas;
  if (horas === undefined || horas === null) horas = 0;
  
  // Asegurar que horas sea un número
  const horasNum = typeof horas === 'number' ? horas : Number(String(horas).trim().replace(/\s+/g, ''));
  
  if (isNaN(horasNum) || horasNum <= 0) {
    throw new Error(`Las horas deben ser un número mayor a 0`)
  }
  
  // Validar costo por hora - Simplificado
  let costoHora = row.costo_hora;
  if (costoHora === undefined || costoHora === null) costoHora = 0;
  
  // Asegurar que costo_hora sea un número
  const costoNum = typeof costoHora === 'number' ? costoHora : Number(String(costoHora).trim().replace(/\s+/g, ''));
  
  if (isNaN(costoNum) || costoNum < 0) {
    throw new Error(`El costo por hora debe ser un número no negativo`)
  }
  
  // Validar pagable (0 o 1) - Simplificado
  let pagable = row.pagable;
  if (pagable === undefined || pagable === null) pagable = 1; // Por defecto es pagable
  
  // Convertir a string para validación
  const pagableStr = String(pagable).trim().toLowerCase();
  
  // Aceptar varios formatos para pagable
  const pagableValido = [
    '0', '1', 0, 1, true, false, 'true', 'false', 'yes', 'no', 'si', 'sí', 'y', 'n', 't', 'f'
  ].includes(pagableStr);
  
  if (!pagableValido) {
    throw new Error(`Pagable debe ser 0 o 1`)
  }
  
  // Actualizar los valores en el objeto row con los valores convertidos
  row.horas = horasNum;
  row.costo_hora = costoNum;
  row.pagable = ['1', 'true', 'yes', 'si', 'sí', 'y', 't', true, 1].includes(pagableStr) ? 1 : 0;
}

/**
 * GET / - Obtiene las cargas de horas
 * 
 * Query params:
 * - periodoId: ID del periodo
 * - areaId: ID del área
 * - page: Número de página (default: 1)
 * - pageSize: Tamaño de página (default: 10)
 * - query: Consulta de búsqueda (opcional)
 * 
 * Devuelve una lista paginada de cargas de horas
 */
export async function getCargasHoras(req: Request, res: Response) {
  try {
    // Obtener usuario autenticado
    const user = req.user as JwtPayload
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Validar parámetros
    const { periodoId, areaId, page = '1', pageSize = '10', query = '' } = req.query
    
    if (!periodoId || !areaId) {
      return res.status(400).json({ 
        error: 'Parámetros incompletos', 
        mensaje: 'Se requieren periodoId y areaId' 
      })
    }
    
    const periodoIdNum = parseInt(periodoId as string)
    const areaIdNum = parseInt(areaId as string)
    const pageNum = parseInt(page as string)
    const pageSizeNum = parseInt(pageSize as string)
    
    if (isNaN(periodoIdNum) || isNaN(areaIdNum) || isNaN(pageNum) || isNaN(pageSizeNum)) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        mensaje: 'periodoId, areaId, page y pageSize deben ser números' 
      })
    }

    // Verificar que el periodo exista
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoIdNum }
    })
    
    if (!periodo) {
      return res.status(404).json({ 
        error: 'Periodo no encontrado', 
        mensaje: `No existe un periodo con ID ${periodoIdNum}` 
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

    // Construir condiciones de búsqueda
    const whereCondition: any = {
      periodoId: periodoIdNum,
      areaId: areaIdNum
    }

    // Si hay consulta de búsqueda, buscar por nombre de docente o materia
    if (query) {
      whereCondition.OR = [
        {
          docente: {
            nombre: {
              contains: query,
              mode: 'insensitive'
            }
          }
        },
        {
          materiaText: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Obtener el total de registros
    const total = await prisma.cargaHoras.count({
      where: whereCondition
    })

    // Calcular el total de páginas
    const totalPages = Math.ceil(total / pageSizeNum)

    // Obtener los registros paginados
    const cargas = await prisma.cargaHoras.findMany({
      where: whereCondition,
      include: {
        docente: {
          select: {
            id: true,
            codigoInterno: true,
            nombre: true,
            rfc: true
          }
        }
      },
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Devolver los resultados
    return res.json({
      data: cargas,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error al obtener cargas de horas:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al obtener las cargas de horas' 
    })
  }
}

/**
 * PUT /:id - Actualiza una carga de horas
 * 
 * Params:
 * - id: ID de la carga de horas
 * 
 * Body:
 * - materia: Nombre de la materia
 * - horas: Número de horas
 * - costo_hora: Costo por hora
 * - pagable: Si es pagable o no (0 o 1)
 * 
 * Actualiza una carga de horas existente
 */
export async function updateCargaHora(req: Request, res: Response) {
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
        mensaje: 'Solo los coordinadores pueden actualizar cargas de horas' 
      })
    }

    // Validar ID
    const { id } = req.params
    const cargaId = parseInt(id || '0')
    
    if (isNaN(cargaId)) {
      return res.status(400).json({ 
        error: 'ID inválido', 
        mensaje: 'El ID debe ser un número' 
      })
    }

    // Verificar que la carga exista
    const carga = await prisma.cargaHoras.findUnique({
      where: { id: cargaId },
      include: {
        docente: true
      }
    })
    
    if (!carga) {
      return res.status(404).json({ 
        error: 'Carga no encontrada', 
        mensaje: `No existe una carga de horas con ID ${cargaId}` 
      })
    }

    // Verificar que el usuario sea coordinador del área de la carga
    const coordArea = await prisma.coordArea.findFirst({
      where: {
        userId: user.id,
        areaId: carga.areaId
      }
    })
    
    if (!coordArea) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'No eres coordinador del área de esta carga' 
      })
    }

    // Validar datos
    const { materia, horas, costo_hora, pagable } = req.body
    
    if (!materia || materia.trim() === '') {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        mensaje: 'La materia es requerida' 
      })
    }
    
    const horasNum = parseFloat(horas)
    if (isNaN(horasNum) || horasNum <= 0) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        mensaje: 'Las horas deben ser un número mayor a 0' 
      })
    }
    
    const costoHoraNum = parseFloat(costo_hora)
    if (isNaN(costoHoraNum) || costoHoraNum < 0) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        mensaje: 'El costo por hora debe ser un número no negativo' 
      })
    }
    
    const pagableValue = pagable === true || pagable === 1 || pagable === '1'

    // Actualizar la carga
    const cargaActualizada = await prisma.cargaHoras.update({
      where: { id: cargaId },
      data: {
        materiaText: materia.trim(),
        horas: horasNum,
        costoHora: costoHoraNum,
        pagable: pagableValue
      },
      include: {
        docente: {
          select: {
            id: true,
            codigoInterno: true,
            nombre: true,
            rfc: true
          }
        }
      }
    })

    // Registrar en auditoría
    await prisma.auditoria.create({
      data: {
        userId: user.id,
        accion: 'ACTUALIZAR_CARGA',
        entidad: 'CargaHoras',
        payload: {
          id: cargaId,
          docenteId: carga.docenteId,
          periodoId: carga.periodoId,
          areaId: carga.areaId,
          materia,
          horas: horasNum,
          costoHora: costoHoraNum,
          pagable: pagableValue,
          timestamp: new Date().toISOString()
        }
      }
    })

    // Devolver la carga actualizada
    return res.json(cargaActualizada)
  } catch (error) {
    console.error('Error al actualizar carga de horas:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al actualizar la carga de horas' 
    })
  }
}

/**
 * DELETE /:id - Elimina una carga de horas
 * 
 * Params:
 * - id: ID de la carga de horas
 * 
 * Elimina una carga de horas existente
 */
export async function deleteCargaHora(req: Request, res: Response) {
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
        mensaje: 'Solo los coordinadores pueden eliminar cargas de horas' 
      })
    }

    // Validar ID
    const { id } = req.params
    const cargaId = parseInt(id || '0')
    
    if (isNaN(cargaId)) {
      return res.status(400).json({ 
        error: 'ID inválido', 
        mensaje: 'El ID debe ser un número' 
      })
    }

    // Verificar que la carga exista
    const carga = await prisma.cargaHoras.findUnique({
      where: { id: cargaId }
    })
    
    if (!carga) {
      return res.status(404).json({ 
        error: 'Carga no encontrada', 
        mensaje: `No existe una carga de horas con ID ${cargaId}` 
      })
    }

    // Verificar que el usuario sea coordinador del área de la carga
    const coordArea = await prisma.coordArea.findFirst({
      where: {
        userId: user.id,
        areaId: carga.areaId
      }
    })
    
    if (!coordArea) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'No eres coordinador del área de esta carga' 
      })
    }

    // Eliminar la carga
    await prisma.cargaHoras.delete({
      where: { id: cargaId }
    })

    // Registrar en auditoría
    await prisma.auditoria.create({
      data: {
        userId: user.id,
        accion: 'ELIMINAR_CARGA',
        entidad: 'CargaHoras',
        payload: {
          id: cargaId,
          docenteId: carga.docenteId,
          periodoId: carga.periodoId,
          areaId: carga.areaId,
          timestamp: new Date().toISOString()
        }
      }
    })

    // Devolver respuesta exitosa
    return res.json({ 
      mensaje: 'Carga de horas eliminada correctamente' 
    })
  } catch (error) {
    console.error('Error al eliminar carga de horas:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al eliminar la carga de horas' 
    })
  }
}
