import { PrismaClient } from '@prisma/client'
import { sendEmail, emailTemplates } from './email.service'

// Enum para estados de baja (debe coincidir con el esquema de Prisma)
enum EstadoBaja {
  PENDIENTE = 'PENDIENTE',
  PROCESADO = 'PROCESADO',
  CANCELADO = 'CANCELADO'
}

const prisma = new PrismaClient()

// Interfaz para los parámetros de creación de solicitud de baja
interface CrearSolicitudBajaParams {
  docenteId: number
  motivoBaja: string
  creadorId: number
}

// Interfaz para los parámetros de actualización de estado de solicitud
interface ActualizarEstadoSolicitudParams {
  solicitudId: number
  estado: EstadoBaja
}

/**
 * Crea una nueva solicitud de baja de docente
 */
export async function crearSolicitudBaja(params: CrearSolicitudBajaParams) {
  const { docenteId, motivoBaja, creadorId } = params

  // Verificar que el docente existe y está activo
  const docente = await prisma.docente.findUnique({
    where: { id: docenteId }
  })

  if (!docente) {
    throw new Error('El docente no existe')
  }

  if (!docente.activo) {
    throw new Error('El docente ya está inactivo')
  }

  // Crear la solicitud de baja
  const solicitud = await prisma.solicitudBaja.create({
    data: {
      docenteId,
      motivoBaja,
      creadorId,
      estadoBaja: EstadoBaja.PENDIENTE
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

  return solicitud
}

/**
 * Actualiza el estado de una solicitud de baja
 */
export async function actualizarEstadoSolicitud(params: ActualizarEstadoSolicitudParams) {
  const { solicitudId, estado } = params

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
  if (estado === EstadoBaja.CANCELADO) {
    await prisma.docente.update({
      where: { id: solicitudActualizada.docenteId },
      data: { activo: true }
    })
  }

  return solicitudActualizada
}

/**
 * Obtiene todas las solicitudes de baja
 */
export async function obtenerSolicitudesBaja(filtro?: { estadoBaja?: EstadoBaja }) {
  return prisma.solicitudBaja.findMany({
    where: filtro,
    include: {
      docente: true,
      creador: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
}

/**
 * Envía un correo de notificación de baja a RH
 */
async function enviarCorreoBaja(solicitud: any) {
  const correoRH = 'rh_bajas@mondragonmexico.edu.mx'
  
  await sendEmail({
    to: correoRH,
    subject: 'Solicitud de Baja de Docente - Universidad Mexicana',
    html: emailTemplates.solicitudBaja(
      solicitud.docente.nombre,
      solicitud.creador.nombre,
      solicitud.motivoBaja
    )
  })
}
