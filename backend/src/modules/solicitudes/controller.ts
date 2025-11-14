import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import { sendEmail, emailTemplates } from '../../services/email.service'

// Reiniciar el cliente de Prisma para asegurar que esté sincronizado con el esquema actualizado
let prisma: PrismaClient

// Función para desconectar el cliente existente
const disconnectExistingClient = async () => {
  try {
    // @ts-ignore
    if (global.prisma) {
      // @ts-ignore
      await global.prisma.$disconnect()
    }
  } catch (e) {
    console.error('Error al desconectar el cliente de Prisma existente:', e)
  }
}

// Intentar desconectar, pero no esperar la promesa
disconnectExistingClient().catch(console.error)

// Crear una nueva instancia del cliente
prisma = new PrismaClient()

// @ts-ignore
global.prisma = prisma

// Esquema para validar la creación de una solicitud de alta
const crearSolicitudSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
})

// Esquema para validar el cambio de estado de una solicitud
const estadoSolicitudSchema = z.object({
  estado: z.enum(['PENDIENTE', 'COMPLETO', 'RECHAZADO']),
  motivoRechazo: z.string().optional(),
})

// POST /solicitudes/alta - Crear una nueva solicitud de alta
export async function crearSolicitudAlta(req: Request, res: Response) {
  try {
    // Validar datos de entrada
    const validacion = crearSolicitudSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { nombre } = validacion.data
    
    // Obtener el ID del usuario autenticado (coordinador)
    const userId = (req as any).user?.id
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Crear la solicitud
    const solicitud = await prisma.solicitudAlta.create({
      data: {
        nombre,
        // Usar sintaxis de tipo any para evitar errores de TypeScript hasta que se regenere el cliente de Prisma
        ...(userId ? { creadorId: userId } as any : {})
        // No es necesario especificar estadoAlta ya que tiene un valor por defecto en el esquema
      }
    })

    return res.status(201).json(solicitud)
  } catch (error) {
    console.error('Error al crear solicitud de alta:', error)
    return res.status(500).json({ error: 'Error al crear solicitud de alta' })
  }
}

// GET /solicitudes - Listar solicitudes con filtro por estado
export async function listarSolicitudes(req: Request, res: Response) {
  try {
    // Validar parámetros de consulta
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const estado = req.query.estado as string | undefined

    // Validar que los números sean válidos
    if (isNaN(page) || isNaN(pageSize) || page < 1 || pageSize < 1) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos' })
    }

    // Calcular skip para paginación
    const skip = (page - 1) * pageSize

    // Construir condición where según el filtro de estado
    const where: any = {}
    if (estado) {
      where.estadoAlta = estado
    }

    // Obtener total de registros según el filtro
    const total = await prisma.solicitudAlta.count({ where })

    // Obtener solicitudes filtradas y paginadas
    const solicitudes = await prisma.solicitudAlta.findMany({
      where,
      include: {
        documentos: true
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    })

    // Calcular total de páginas
    const totalPages = Math.ceil(total / pageSize)

    return res.json({
      data: solicitudes,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error al listar solicitudes:', error)
    return res.status(500).json({ error: 'Error al obtener solicitudes' })
  }
}

// GET /solicitudes/pendientes - Listar solicitudes pendientes (mantenido por compatibilidad)
export async function listarSolicitudesPendientes(req: Request, res: Response) {
  try {
    // Validar parámetros de consulta
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10

    // Validar que los números sean válidos
    if (isNaN(page) || isNaN(pageSize) || page < 1 || pageSize < 1) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos' })
    }

    // Calcular skip para paginación
    const skip = (page - 1) * pageSize

    // Obtener total de registros pendientes
    const total = await prisma.solicitudAlta.count({
      where: {
        estadoAlta: { not: 'COMPLETO' }
      }
    })

    // Obtener solicitudes pendientes paginadas
    const solicitudes = await prisma.solicitudAlta.findMany({
      where: {
        estadoAlta: { not: 'COMPLETO' }
      },
      include: {
        documentos: true
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    })

    // Calcular total de páginas
    const totalPages = Math.ceil(total / pageSize)

    return res.json({
      data: solicitudes,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error al listar solicitudes pendientes:', error)
    return res.status(500).json({ error: 'Error al obtener solicitudes pendientes' })
  }
}

// POST /solicitudes/alta/:id/documentos - Subir documento para una solicitud
export async function subirDocumentoSolicitud(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { tipo } = req.body
    
    if (!id) {
      return res.status(400).json({ error: 'ID de solicitud requerido' })
    }
    
    const solicitudId = parseInt(id)
    
    if (isNaN(solicitudId)) {
      return res.status(400).json({ error: 'ID de solicitud inválido' })
    }
    
    // Validar tipo de documento
    const tiposValidos = ['constanciaFiscal', 'comprobanteDomicilio', 'cv', 'cuentaBancaria', 'ine']
    if (!tipo || !tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de documento inválido' })
    }
    
    // Verificar que la solicitud exista
    const solicitud = await prisma.solicitudAlta.findUnique({
      where: { id: solicitudId },
      include: { documentos: true }
    })
    
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' })
    }
    
    // Verificar que se haya subido un archivo
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' })
    }
    
    // Crear directorio para documentos si no existe
    const uploadsDir = path.join(process.cwd(), 'uploads', 'solicitudes', solicitudId.toString())
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    
    // Generar nombre de archivo único
    const timestamp = new Date().getTime()
    const fileExtension = path.extname(req.file.originalname)
    const fileName = `${tipo}_${timestamp}${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)
    
    // Mover el archivo a la ubicación final
    fs.renameSync(req.file.path, filePath)
    
    // Ruta relativa para acceder al archivo
    // Usamos una ruta que comienza con /uploads para que sea accesible desde el frontend
    const relativePath = `/uploads/solicitudes/${solicitudId}/${fileName}`
    
    // Actualizar o crear registro de documentos
    let solicitudActualizada
    
    if (solicitud.documentos) {
      // Si ya existe un registro de documentos, actualizarlo
      const updateData: Record<string, string> = {};
      updateData[tipo] = relativePath;
      
      solicitudActualizada = await prisma.solicitudAlta.update({
        where: { id: solicitudId },
        data: {
          documentos: {
            update: updateData
          }
        },
        include: { documentos: true }
      })
    } else {
      // Si no existe, crear un nuevo registro
      const createData: Record<string, string> = {};
      createData[tipo] = relativePath;
      
      solicitudActualizada = await prisma.solicitudAlta.update({
        where: { id: solicitudId },
        data: {
          documentos: {
            create: createData
          }
        },
        include: { documentos: true }
      })
    }
    
    return res.json(solicitudActualizada)
  } catch (error) {
    console.error('Error al subir documento:', error)
    // Eliminar archivo temporal si existe
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    return res.status(500).json({ error: 'Error al subir documento' })
  }
}

// PATCH /solicitudes/alta/:id/estado - Actualizar estado de una solicitud
export async function actualizarEstadoSolicitud(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    if (!id) {
      return res.status(400).json({ error: 'ID de solicitud requerido' })
    }
    
    const solicitudId = parseInt(id)
    
    if (isNaN(solicitudId)) {
      return res.status(400).json({ error: 'ID de solicitud inválido' })
    }
    
    // Validar datos de entrada
    const validacion = estadoSolicitudSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }
    
    const { estado, motivoRechazo } = validacion.data
    
    // Verificar que la solicitud exista
    const solicitud = await prisma.solicitudAlta.findUnique({
      where: { id: solicitudId },
      include: { documentos: true }
    })
    
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' })
    }
    
    // Validar que si el estado es RECHAZADO, se proporcione un motivo
    if (estado === 'RECHAZADO' && !motivoRechazo) {
      return res.status(400).json({ error: 'Debe proporcionar un motivo de rechazo' })
    }
    
    // Actualizar estado de la solicitud
    const solicitudActualizada = await prisma.solicitudAlta.update({
      where: { id: solicitudId },
      data: {
        estadoAlta: estado as any, // Usar 'as any' para evitar problemas de tipo
        // Solo incluir motivoRechazo si el estado es RECHAZADO y hay un valor
        ...(estado === 'RECHAZADO' && motivoRechazo ? { motivoRechazo } : {})
      }
    })
    
    // Si el estado es COMPLETO, crear un nuevo docente con los datos de la solicitud
    if (estado === 'COMPLETO') {
      try {
        // Generar un código interno único
        const timestamp = new Date().getTime().toString().slice(-6)
        const codigoInterno = `T${timestamp}`
        
        // Crear el docente
        await prisma.docente.create({
          data: {
            nombre: solicitud.nombre,
            codigoInterno,
            rfc: `TEMP${timestamp}`, // RFC temporal, deberá actualizarse después
            activo: true
          }
        })
      } catch (error) {
        console.error('Error al crear docente desde solicitud:', error)
        // No interrumpir el flujo si falla la creación del docente
      }
    }
    
    // Intentar obtener el correo del coordinador directamente desde la base de datos
    try {
      // Obtener el coordinador desde la base de datos usando una consulta SQL directa
      // ya que la relación en Prisma puede no estar actualizada
      const result = await prisma.$queryRaw`
        SELECT u.correo 
        FROM "User" u 
        JOIN "SolicitudAlta" s ON u.id = s."creadorId" 
        WHERE s.id = ${solicitudId}
      `;
      
      const coordinadorEmail = result && Array.isArray(result) && result.length > 0 ? (result[0] as any).correo : null;
      
      if (coordinadorEmail) {
        console.log(`Intentando enviar correo a coordinador: ${coordinadorEmail}`);
        
        try {
          if (estado === 'COMPLETO') {
            await sendEmail({
              to: coordinadorEmail,
              subject: 'Solicitud de Alta Aprobada - Universidad Mexicana',
              html: emailTemplates.solicitudAprobada(solicitudActualizada.nombre)
            });
            console.log(`Correo de aprobación enviado a ${coordinadorEmail}`);
          } else if (estado === 'RECHAZADO' && motivoRechazo) {
            await sendEmail({
              to: coordinadorEmail,
              subject: 'Solicitud de Alta Rechazada - Universidad Mexicana',
              html: emailTemplates.solicitudRechazada(solicitudActualizada.nombre, motivoRechazo)
            });
            console.log(`Correo de rechazo enviado a ${coordinadorEmail}`);
          }
        } catch (emailError: any) {
          console.error('Error detallado al enviar correo:', {
            error: emailError.message,
            stack: emailError.stack,
            code: emailError.code,
            command: emailError.command,
            responseCode: emailError.responseCode,
            response: emailError.response
          });
        }
      } else {
        console.log('No se encontró correo del coordinador para la solicitud:', solicitudId);
      }
    } catch (dbError) {
      console.error('Error al buscar el correo del coordinador:', dbError);
    }
    
    // No hay alternativa de envío de correo, solo se envía al coordinador
    
    return res.json(solicitudActualizada)
  } catch (error) {
    console.error('Error al actualizar estado de solicitud:', error)
    return res.status(500).json({ error: 'Error al actualizar estado de solicitud' })
  }
}

// Función para verificar si todos los documentos están completos
export async function verificarDocumentosSolicitudCompletos(solicitudId: number): Promise<boolean> {
  try {
    const solicitud = await prisma.solicitudAlta.findUnique({
      where: { id: solicitudId },
      include: { documentos: true }
    })
    
    if (!solicitud || !solicitud.documentos) {
      return false
    }
    
    const { documentos } = solicitud
    
    return !!(
      documentos.constanciaFiscal &&
      documentos.comprobanteDomicilio &&
      documentos.cv &&
      documentos.cuentaBancaria &&
      documentos.ine
    )
  } catch (error) {
    console.error('Error al verificar documentos completos:', error)
    return false
  }
}
