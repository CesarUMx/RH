import { Request, Response } from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import csvParser from 'csv-parser'
import * as XLSX from 'xlsx'
import { Readable } from 'stream'
import { JwtPayload } from '../../middlewares/auth'

const prisma = new PrismaClient()

// Esquema de validación para RFC (formato simplificado)
// En un caso real, se usaría una expresión regular más precisa
// Versión original: /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/
// Versión más permisiva para importación:
const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{0,3}$/

// Esquemas de validación
const docenteSchema = z.object({
  codigoInterno: z.string().min(1, 'El código interno es requerido'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  rfc: z.string().regex(rfcRegex, 'El RFC no tiene un formato válido'),
  activo: z.boolean().optional().default(true)
})

const docenteUpdateSchema = z.object({
  codigoInterno: z.string().min(1, 'El código interno es requerido').optional(),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').optional(),
  rfc: z.string().regex(rfcRegex, 'El RFC no tiene un formato válido').optional(),
  activo: z.boolean().optional()
})

// Esquema para paginación
const paginacionSchema = z.object({
  query: z.string().optional().default(''),
  page: z.string().optional().default('1'),
  pageSize: z.string().optional().default('10'),
  areaId: z.string().optional()
})

// GET /docentes - Listar docentes con paginación y búsqueda
export async function listarDocentes(req: Request, res: Response) {
  try {
    // Obtener usuario actual
    const user = req.user as JwtPayload
    
    // Validar parámetros de consulta
    const validacion = paginacionSchema.safeParse(req.query)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Parámetros de consulta inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { query, page, pageSize, areaId } = validacion.data
    const pageNum = parseInt(page)
    const pageSizeNum = parseInt(pageSize)

    // Validar que los números sean válidos
    if (isNaN(pageNum) || isNaN(pageSizeNum) || pageNum < 1 || pageSizeNum < 1) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos' })
    }

    // Calcular skip para paginación
    const skip = (pageNum - 1) * pageSizeNum

    // Construir condición de búsqueda básica
    let where: Prisma.DocenteWhereInput = query
      ? {
          OR: [
            { codigoInterno: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { nombre: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { rfc: { contains: query, mode: Prisma.QueryMode.insensitive } }
          ]
        }
      : {}
      
    // Para docentes, los coordinadores pueden ver todos los docentes sin filtrar por área
    // El filtro por área solo se aplica para ADMIN y RH si se proporciona explícitamente
    if (areaId) {
      // Para usuarios ADMIN o RH, si se proporciona areaId, filtrar por ese área
      const areaIdNum = parseInt(areaId)
      
      if (isNaN(areaIdNum)) {
        return res.status(400).json({ error: 'ID de área inválido' })
      }
      
      where = {
        ...where,
        cargas: {
          some: {
            areaId: areaIdNum
          }
        }
      }
    }

    // Obtener total de registros
    const total = await prisma.docente.count({ where })

    // Obtener docentes paginados
    const docentes = await prisma.docente.findMany({
      where,
      skip,
      take: pageSizeNum,
      orderBy: { nombre: 'asc' }
    })

    // Calcular total de páginas
    const totalPages = Math.ceil(total / pageSizeNum)

    return res.json({
      data: docentes,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error al listar docentes:', error)
    return res.status(500).json({ error: 'Error al obtener docentes' })
  }
}

// POST /docentes - Crear un nuevo docente
export async function crearDocente(req: Request, res: Response) {
  try {
    // Validar datos de entrada
    const validacion = docenteSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { codigoInterno, nombre, rfc, activo } = validacion.data

    // Verificar que el código interno no exista
    const docenteExistenteCodigo = await prisma.docente.findUnique({
      where: { codigoInterno }
    })

    if (docenteExistenteCodigo) {
      return res.status(400).json({ error: 'El código interno ya está registrado' })
    }

    // Verificar que el RFC no exista
    const docenteExistenteRFC = await prisma.docente.findUnique({
      where: { rfc }
    })

    if (docenteExistenteRFC) {
      return res.status(400).json({ error: 'El RFC ya está registrado' })
    }

    // Crear el docente
    const docente = await prisma.docente.create({
      data: {
        codigoInterno,
        nombre,
        rfc,
        activo
      }
    })

    return res.status(201).json(docente)
  } catch (error) {
    console.error('Error al crear docente:', error)
    return res.status(500).json({ error: 'Error al crear docente' })
  }
}

// PUT /docentes/:id - Actualizar un docente existente
export async function actualizarDocente(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de docente requerido' })
    }
    
    const docenteId = parseInt(id)

    if (isNaN(docenteId)) {
      return res.status(400).json({ error: 'ID de docente inválido' })
    }

    // Validar datos de entrada
    const validacion = docenteUpdateSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { codigoInterno, nombre, rfc, activo } = validacion.data

    // Verificar que el docente exista
    const docenteExistente = await prisma.docente.findUnique({
      where: { id: docenteId }
    })

    if (!docenteExistente) {
      return res.status(404).json({ error: 'Docente no encontrado' })
    }

    // Si se está actualizando el código interno, verificar que no exista otro con ese código
    if (codigoInterno && codigoInterno !== docenteExistente.codigoInterno) {
      const codigoExistente = await prisma.docente.findUnique({
        where: { codigoInterno }
      })

      if (codigoExistente) {
        return res.status(400).json({ error: 'El código interno ya está registrado' })
      }
    }

    // Si se está actualizando el RFC, verificar que no exista otro con ese RFC
    if (rfc && rfc !== docenteExistente.rfc) {
      const rfcExistente = await prisma.docente.findUnique({
        where: { rfc }
      })

      if (rfcExistente) {
        return res.status(400).json({ error: 'El RFC ya está registrado' })
      }
    }

    // Actualizar el docente
    const docente = await prisma.docente.update({
      where: { id: docenteId },
      data: {
        ...(codigoInterno && { codigoInterno }),
        ...(nombre && { nombre }),
        ...(rfc && { rfc }),
        ...(activo !== undefined && { activo })
      }
    })

    return res.json(docente)
  } catch (error) {
    console.error('Error al actualizar docente:', error)
    return res.status(500).json({ error: 'Error al actualizar docente' })
  }
}

// DELETE /docentes/:id - Eliminar un docente
export async function eliminarDocente(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de docente requerido' })
    }
    
    const docenteId = parseInt(id)

    if (isNaN(docenteId)) {
      return res.status(400).json({ error: 'ID de docente inválido' })
    }

    // Verificar que el docente exista
    const docenteExistente = await prisma.docente.findUnique({
      where: { id: docenteId },
      include: { cargas: true }
    })

    if (!docenteExistente) {
      return res.status(404).json({ error: 'Docente no encontrado' })
    }

    // Verificar si tiene cargas asociadas
    if (docenteExistente.cargas.length > 0) {
      // En lugar de eliminar, marcar como inactivo
      await prisma.docente.update({
        where: { id: docenteId },
        data: { activo: false }
      })

      return res.json({ 
        mensaje: 'Docente marcado como inactivo porque tiene cargas asociadas' 
      })
    }

    // Si no tiene dependencias, eliminar completamente
    await prisma.docente.delete({
      where: { id: docenteId }
    })

    return res.json({ mensaje: 'Docente eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar docente:', error)
    return res.status(500).json({ error: 'Error al eliminar docente' })
  }
}

// Función para procesar archivos CSV
function procesarCSV(filePath: string): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const results: Record<string, any>[] = []

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data: Record<string, any>) => results.push(data))
      .on('end', () => {
        resolve(results)
      })
      .on('error', (error: Error) => {
        reject(error)
      })
  })
}

// Función para procesar archivos XLSX
function procesarXLSX(filePath: string): Record<string, any>[] {
  const workbook = XLSX.readFile(filePath)
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [];
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return [];
  }
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    return [];
  }
  
  // Inspeccionar los encabezados del archivo
  console.log('Procesando archivo Excel:', filePath);
  console.log('Hoja de cálculo:', sheetName);
  
  // Obtener el rango de la hoja
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  console.log('Rango de la hoja:', worksheet['!ref']);
  
  // Obtener los encabezados (primera fila)
  const headers = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({r: range.s.r, c: C})];
    if (cell && cell.v) {
      headers.push({
        column: XLSX.utils.encode_col(C),
        value: cell.v.toString()
      });
    }
  }
  console.log('Encabezados detectados:', headers);
  
  // Convertir a JSON con opciones para manejar mejor los encabezados
  const data = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,  // Convertir todos los valores a strings
    defval: '',   // Valor por defecto para celdas vacías
    header: 'A'    // Usar letras de columna como encabezados si no hay encabezados
  }) as Record<string, any>[];
  
  // Mostrar la primera fila para depuración
  if (data.length > 0) {
    console.log('Primera fila de datos:', data[0]);
  }
  
  return data
}

// Interfaz para los datos normalizados
interface DatoDocente {
  codigoInterno: string;
  nombre: string;
  rfc: string;
  activo: boolean;
  error?: string;
}

// Función para normalizar datos de importación
function normalizarDatoDocente(row: Record<string, any>): DatoDocente {
  // Imprimir la fila completa para depuración
  console.log('Normalizando fila:', row);
  
  // Extraer campos del registro - intentar diferentes nombres de campo posibles
  // Para código interno, buscar diferentes variantes y formatos
  let codigoInterno = '';
  
  // Buscar el campo de código interno con diferentes nombres posibles
  const posiblesCamposCodigo = ['codigo_interno', 'codigointerno', 'codigo', 'code', 'id', 'num', 'numero', 'A'];
  
  for (const campo of posiblesCamposCodigo) {
    if (row[campo] !== undefined && row[campo] !== null) {
      codigoInterno = row[campo].toString().trim();
      console.log(`Encontrado código interno en campo '${campo}': ${codigoInterno}`);
      break;
    }
  }
  
  // Si no se encontró el código, buscar campos numéricos sin nombre específico
  if (!codigoInterno) {
    for (const key in row) {
      const value = row[key];
      // Si es un número o parece un código y no se ha encontrado otro campo que parezca un código
      if (value !== null && value !== undefined && 
          (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.toString().trim()))) && 
          !['nombre', 'rfc', 'activo', 'B', 'C', 'D'].includes(key.toLowerCase())) {
        codigoInterno = value.toString().trim();
        console.log(`Encontrado código interno en campo genérico '${key}': ${codigoInterno}`);
        break;
      }
    }
  }
  
  // Buscar el campo de nombre con diferentes nombres posibles
  let nombre = '';
  const posiblesCamposNombre = ['nombre', 'name', 'docente', 'profesor', 'maestro', 'nombre_completo', 'nombrecompleto', 'fullname', 'full_name', 'B'];
  
  for (const campo of posiblesCamposNombre) {
    if (row[campo] !== undefined && row[campo] !== null) {
      nombre = row[campo].toString().trim();
      console.log(`Encontrado nombre en campo '${campo}': ${nombre}`);
      break;
    }
  }
  
  // Si no se encontró el nombre, intentar con la segunda columna (B)
  if (!nombre && row['B'] !== undefined) {
    nombre = row['B'].toString().trim();
    console.log(`Usando segunda columna como nombre: ${nombre}`);
  }
  
  // Buscar el campo de RFC con diferentes nombres posibles
  let rfc = '';
  const posiblesCamposRFC = ['rfc', 'RFC', 'r.f.c.', 'registro_fiscal', 'registrofiscal', 'tax_id', 'C'];
  
  for (const campo of posiblesCamposRFC) {
    if (row[campo] !== undefined && row[campo] !== null) {
      rfc = row[campo].toString().trim().toUpperCase();
      console.log(`Encontrado RFC en campo '${campo}': ${rfc}`);
      break;
    }
  }
  
  // Si no se encontró el RFC, intentar con la tercera columna (C)
  if (!rfc && row['C'] !== undefined) {
    rfc = row['C'].toString().trim().toUpperCase();
    console.log(`Usando tercera columna como RFC: ${rfc}`);
  }
  
  // Imprimir para depuración
  console.log('Datos de fila:', { rowKeys: Object.keys(row), rowValues: Object.values(row), codigoInterno, nombre, rfc });
  
  // Normalizar campo activo
  let activo = true
  if ('activo' in row) {
    const activoValue = row.activo
    if (typeof activoValue === 'boolean') {
      activo = activoValue
    } else if (typeof activoValue === 'string') {
      activo = ['true', '1', 'si', 'sí', 'yes'].includes(activoValue.toLowerCase())
    } else if (typeof activoValue === 'number') {
      activo = activoValue === 1
    }
  }

  // Formatear el código interno a 6 dígitos
  if (codigoInterno) {
    // Convertir a string y eliminar espacios
    const codigoStr = codigoInterno.toString().trim();
    // Rellenar con ceros a la izquierda hasta completar 6 dígitos
    codigoInterno = codigoStr.padStart(6, '0');
    console.log(`Código interno formateado a 6 dígitos: ${codigoInterno}`);
  }

  // Validar campos requeridos
  if (!codigoInterno) {
    return { codigoInterno, nombre, rfc, activo, error: 'Código interno requerido' }
  }
  
  if (!nombre) {
    return { codigoInterno, nombre, rfc, activo, error: 'Nombre requerido' }
  }
  
  if (!rfc) {
    return { codigoInterno, nombre, rfc, activo, error: 'RFC requerido' }
  }
  
  // Validar formato de RFC
  if (!rfcRegex.test(rfc)) {
    return { codigoInterno, nombre, rfc, activo, error: 'Formato de RFC inválido' }
  }

  return { codigoInterno, nombre, rfc, activo }
}

// GET /docentes/plantilla - Descargar plantilla para importar docentes
export async function descargarPlantilla(req: Request, res: Response) {
  try {
    // Crear la plantilla
    const workbook = XLSX.utils.book_new()
    
    // Datos de ejemplo
    const data = [
      {
        codigo_interno: '012345',
        nombre: 'DOCENTE EJEMPLO',
        rfc: 'XAXX010101000',
        activo: '1'
      },
      {
        codigo_interno: '067890',
        nombre: 'OTRO DOCENTE EJEMPLO',
        rfc: 'XEXX010101000',
        activo: '1'
      }
    ]
    
    // Crear la hoja de cálculo con encabezados
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: ['codigo_interno', 'nombre', 'rfc', 'activo'],
      skipHeader: false
    })
    
    // Establecer encabezados más descriptivos
    const headers = [
      { v: 'codigo_interno', t: 's' },
      { v: 'nombre', t: 's' },
      { v: 'rfc', t: 's' },
      { v: 'activo', t: 's' }
    ]
    
    // Reemplazar encabezados - usar exactamente los nombres de campo esperados
    XLSX.utils.sheet_add_aoa(worksheet, [headers.map(h => h.v)], { origin: 'A1' })
    
    // Añadir una fila de instrucciones
    const instrucciones = [
      { v: 'INSTRUCCIONES', t: 's' },
      { v: 'NO MODIFICAR ESTA FILA', t: 's' },
      { v: 'FORMATO: AAAA010101AAA', t: 's' },
      { v: '1=SÍ, 0=NO', t: 's' }
    ]
    XLSX.utils.sheet_add_aoa(worksheet, [instrucciones], { origin: 'A2' })
    
    // Ajustar ancho de columnas
    const wscols = [
      { wch: 15 }, // Código Interno
      { wch: 30 }, // Nombre del Docente
      { wch: 15 }, // RFC
      { wch: 20 }  // Activo
    ]
    worksheet['!cols'] = wscols
    
    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Docentes')
    
    // Crear directorio temporal si no existe
    const uploadsDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    
    // Generar nombre de archivo único
    const timestamp = new Date().getTime()
    const fileName = `plantilla_docentes_${timestamp}.xlsx`
    const filePath = path.join(uploadsDir, fileName)
    
    // Escribir el archivo
    XLSX.writeFile(workbook, filePath)
    
    // Enviar el archivo como respuesta
    res.download(filePath, 'plantilla_docentes.xlsx', (err) => {
      if (err) {
        console.error('Error al enviar el archivo:', err)
      }
      
      // Eliminar el archivo después de enviarlo
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error al eliminar el archivo temporal:', unlinkErr)
        }
      })
    })
  } catch (error) {
    console.error('Error al generar plantilla:', error)
    return res.status(500).json({ 
      error: 'Error interno', 
      mensaje: 'Ocurrió un error al generar la plantilla' 
    })
  }
}

// POST /docentes/import - Importar docentes desde archivo CSV/XLSX
export async function importarDocentes(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' })
    }
    
    // Procesar el archivo
    const filePath = req.file.path
    const fileExtension = path.extname(req.file.originalname).toLowerCase()
    
    console.log('Procesando archivo:', req.file.originalname, 'Extensión:', fileExtension)
    
    // Procesar archivo según su extensión
    let rawData: any[] = []
    if (fileExtension === '.csv') {
      rawData = await procesarCSV(filePath)
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      rawData = procesarXLSX(filePath)
    } else {
      // Eliminar archivo temporal
      fs.unlinkSync(filePath)
      return res.status(400).json({ error: 'Formato de archivo no soportado. Use CSV o XLSX.' })
    }

    // Normalizar y validar datos
    const datos: DatoDocente[] = rawData
      .filter((row): row is Record<string, any> => 
        row !== null && typeof row === 'object' && Object.keys(row).length > 0
      ) // Filtrar filas vacías
      .map(normalizarDatoDocente)

    // Verificar si hay datos para procesar
    if (datos.length === 0) {
      // Eliminar archivo temporal
      fs.unlinkSync(filePath)
      return res.status(400).json({ error: 'El archivo no contiene datos válidos' })
    }

    // Detectar duplicados en el archivo
    const codigosInternos = new Set<string>()
    const rfcs = new Set<string>()
    const duplicadosArchivo = datos.filter(d => {
      if (!d.error) {
        const codigoDuplicado = codigosInternos.has(d.codigoInterno)
        const rfcDuplicado = rfcs.has(d.rfc)
        
        codigosInternos.add(d.codigoInterno)
        rfcs.add(d.rfc)
        
        return codigoDuplicado || rfcDuplicado
      }
      return false
    }).map(d => ({
      ...d,
      error: 'Registro duplicado en el archivo'
    }))

    // Preparar resultados
    const resultados: {
      total: number;
      insertados: number;
      actualizados: number;
      errores: any[];
      erroresDetalle: any[];
      erroresArchivo?: string;
    } = {
      total: datos.length,
      insertados: 0,
      actualizados: 0,
      errores: [],
      erroresDetalle: []
    }

    // Procesar registros válidos
    for (let i = 0; i < datos.length; i++) {
      const dato = datos[i]
      
      // Si ya tiene error, agregarlo a los resultados
      if (dato && dato.error) {
        resultados.errores.push({
          linea: i + 2, // +2 porque i es 0-indexed y hay una fila de encabezado
          codigoInterno: dato.codigoInterno,
          rfc: dato.rfc,
          error: dato.error
        })
        resultados.erroresDetalle.push({
          ...dato,
          linea: i + 2
        })
        continue
      }
      
      // Verificar si el registro es un duplicado en el archivo
      if (dato) {
        const esDuplicado = duplicadosArchivo.some(d => 
          d && (d.codigoInterno === dato.codigoInterno || d.rfc === dato.rfc)
        )
        
        if (esDuplicado) {
          resultados.errores.push({
            linea: i + 2,
            codigoInterno: dato.codigoInterno,
            rfc: dato.rfc,
            error: 'Registro duplicado en el archivo'
          })
          resultados.erroresDetalle.push({
            ...dato,
            linea: i + 2,
            error: 'Registro duplicado en el archivo'
          })
          continue
        }
      } else {
        continue; // Saltar este registro si es undefined
      }

      try {
        // Verificar si ya existe un docente con ese código interno
        const docenteExistente = await prisma.docente.findUnique({
          where: { codigoInterno: dato.codigoInterno }
        })

        if (docenteExistente) {
          // Verificar si el RFC ya existe pero pertenece a otro docente
          const rfcExistente = await prisma.docente.findUnique({
            where: { rfc: dato.rfc }
          })

          if (rfcExistente && rfcExistente.id !== docenteExistente.id) {
            resultados.errores.push({
              linea: i + 2,
              codigoInterno: dato.codigoInterno,
              rfc: dato.rfc,
              error: 'RFC ya registrado para otro docente'
            })
            resultados.erroresDetalle.push({
              ...dato,
              linea: i + 2,
              error: 'RFC ya registrado para otro docente'
            })
            continue
          }

          // Actualizar docente existente
          await prisma.docente.update({
            where: { id: docenteExistente.id },
            data: {
              nombre: dato.nombre,
              rfc: dato.rfc,
              activo: dato.activo
            }
          })
          resultados.actualizados++
        } else {
          // Verificar si el RFC ya existe
          const rfcExistente = await prisma.docente.findUnique({
            where: { rfc: dato.rfc }
          })

          if (rfcExistente) {
            resultados.errores.push({
              linea: i + 2,
              codigoInterno: dato.codigoInterno,
              rfc: dato.rfc,
              error: 'RFC ya registrado'
            })
            resultados.erroresDetalle.push({
              ...dato,
              linea: i + 2,
              error: 'RFC ya registrado'
            })
            continue
          }

          // Crear nuevo docente
          await prisma.docente.create({
            data: {
              codigoInterno: dato.codigoInterno,
              nombre: dato.nombre,
              rfc: dato.rfc,
              activo: dato.activo
            }
          })
          resultados.insertados++
        }
      } catch (error) {
        console.error(`Error procesando línea ${i + 2}:`, error)
        resultados.errores.push({
          linea: i + 2,
          codigoInterno: dato.codigoInterno,
          rfc: dato.rfc,
          error: 'Error al procesar el registro'
        })
        resultados.erroresDetalle.push({
          ...dato,
          linea: i + 2,
          error: 'Error al procesar el registro'
        })
      }
    }

    // Generar archivo de errores si hay errores
    if (resultados.erroresDetalle.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const erroresFilePath = path.join(path.dirname(filePath), `errores-import-${timestamp}.json`)
      fs.writeFileSync(erroresFilePath, JSON.stringify(resultados.erroresDetalle, null, 2))
      resultados.erroresArchivo = `/uploads/errores-import-${timestamp}.json`
    }

    // Eliminar archivo temporal
    fs.unlinkSync(filePath)

    return res.json(resultados)
  } catch (error) {
    console.error('Error al importar docentes:', error)
    // Eliminar archivo temporal si existe
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    return res.status(500).json({ error: 'Error al importar docentes' })
  }
}
