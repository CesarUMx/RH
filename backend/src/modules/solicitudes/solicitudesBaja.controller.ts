import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { sendEmail, emailTemplates } from '../../services/email.service'
import { suspenderUsuarioWorkspace } from '../../services/googleWorkspace.service'

const prisma = new PrismaClient()

// Enum para estados de baja (debe coincidir con el esquema de Prisma)
enum EstadoBaja {
  PENDIENTE = 'PENDIENTE',
  PROCESADO = 'PROCESADO',
  CANCELADO = 'CANCELADO'
}

// Esquema para validar la creación de una solicitud de baja
const crearSolicitudBajaSchema = z.object({
  docenteId: z.number(),
  motivoBaja: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
})

// Esquema para validar el cambio de estado de una solicitud
const estadoSolicitudBajaSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PROCESADO', 'CANCELADO']),
})

// POST /solicitudes/baja - Crear una nueva solicitud de baja
export async function crearSolicitudBaja(req: Request, res: Response) {
  try {
    // Validar datos de entrada
    const validacion = crearSolicitudBajaSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { docenteId, motivoBaja } = validacion.data
    
    // Obtener el ID del usuario autenticado (coordinador)
    const userId = (req as any).user?.id
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Verificar que el docente existe y está activo
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId }
    })

    if (!docente) {
      return res.status(404).json({ error: 'El docente no existe' })
    }

    if (!docente.activo) {
      return res.status(400).json({ error: 'El docente ya está inactivo' })
    }

    // Crear la solicitud de baja
    const solicitud = await prisma.solicitudBaja.create({
      data: {
        docenteId,
        motivoBaja,
        creadorId: userId,
        estadoBaja: 'PENDIENTE'
      },
      include: {
        docente: true,
        creador: true
      }
    })

    // Desactivar el docente inmediatamente
    await prisma.docente.update({
      where: { id: docenteId },
      data: { activo: false }
    })

    // Enviar correo a RH
    try {
      await enviarCorreoBaja(solicitud)
    } catch (error) {
      console.error('Error al enviar correo de notificación de baja:', error)
      // No interrumpir el flujo si falla el envío de correo
    }

    return res.status(201).json(solicitud)
  } catch (error) {
    console.error('Error al crear solicitud de baja:', error)
    return res.status(500).json({ error: 'Error al crear solicitud de baja' })
  }
}

// PUT /solicitudes/baja/:id/estado - Actualizar el estado de una solicitud de baja
export async function actualizarEstadoSolicitudBaja(req: Request, res: Response) {
  try {
    const idParam = req.params.id
    if (!idParam) {
      return res.status(400).json({ error: 'ID de solicitud inválido' })
    }

    const solicitudId = parseInt(idParam, 10)
    if (isNaN(solicitudId)) {
      return res.status(400).json({ error: 'ID de solicitud inválido' })
    }

    // Validar datos de entrada
    const validacion = estadoSolicitudBajaSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { estado } = validacion.data

    // Verificar que la solicitud existe
    const solicitudExistente = await prisma.solicitudBaja.findUnique({
      where: { id: solicitudId }
    })

    if (!solicitudExistente) {
      return res.status(404).json({ error: 'Solicitud no encontrada' })
    }

    // Actualizar el estado de la solicitud
    const solicitudActualizada = await prisma.solicitudBaja.update({
      where: { id: solicitudId },
      data: { estadoBaja: estado },
      include: {
        docente: true,
        creador: true
      }
    })

    // Si se cancela la solicitud, reactivar el docente
    if (estado === 'CANCELADO') {
      await prisma.docente.update({
        where: { id: solicitudActualizada.docenteId },
        data: { activo: true }
      })
    }

    // Si se procesa la baja, suspender la cuenta institucional si existe
    if (estado === 'PROCESADO') {
      try {
        // Buscar si el docente tiene un User con cuenta institucional
        // La búsqueda es por nombre del docente como best-effort (no hay link directo Docente↔User)
        const cuentas = await prisma.cuentaInstitucional.findMany({
          where: { user: { nombre: solicitudActualizada.docente.nombre } },
          select: { id: true, correoInstitucional: true },
        })
        for (const cuenta of cuentas) {
          await suspenderUsuarioWorkspace(cuenta.correoInstitucional)
          await prisma.cuentaInstitucional.update({
            where: { id: cuenta.id },
            data: { estado: 'SUSPENDIDA' },
          })
        }
      } catch (gwError) {
        // No interrumpir el proceso de baja si falla la suspensión de cuenta
        console.error('No se pudo suspender la cuenta institucional (best-effort):', gwError)
      }
    }

    return res.json(solicitudActualizada)
  } catch (error) {
    console.error('Error al actualizar estado de solicitud de baja:', error)
    return res.status(500).json({ error: 'Error al actualizar estado de solicitud de baja' })
  }
}

// GET /solicitudes/baja - Listar solicitudes de baja con filtro por estado
export async function listarSolicitudesBaja(req: Request, res: Response) {
  try {
    const estado = req.query.estado as string | undefined
    
    // Construir filtro
    const filtro: any = {}
    if (estado && ['PENDIENTE', 'PROCESADO', 'CANCELADO'].includes(estado)) {
      filtro.estadoBaja = estado
    }
    
    // Obtener solicitudes
    const solicitudes = await prisma.solicitudBaja.findMany({
      where: filtro,
      include: {
        docente: true,
        creador: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return res.json(solicitudes)
  } catch (error) {
    console.error('Error al listar solicitudes de baja:', error)
    return res.status(500).json({ error: 'Error al listar solicitudes de baja' })
  }
}

// Función para enviar correo de notificación de baja
async function enviarCorreoBaja(solicitud: any) {
  const correoRH = 'rh_bajas@mondragonmexico.edu.mx'
  
  await sendEmail({
    to: correoRH,
    subject: 'Solicitud de Baja de Docente - Universidad Mondragón México',
    html: emailTemplates.solicitudBaja(
      solicitud.docente.nombre,
      solicitud.creador.nombre,
      solicitud.motivoBaja
    )
  })
}
