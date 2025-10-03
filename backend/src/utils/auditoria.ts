import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Registra una acción en la tabla de auditoría
 * @param userId ID del usuario que realiza la acción (opcional)
 * @param accion Tipo de acción (CREAR, ACTUALIZAR, ELIMINAR, etc.)
 * @param entidad Entidad sobre la que se realiza la acción
 * @param entidadId ID de la entidad (opcional)
 * @param payload Datos relacionados con la acción
 */
export const auditarAccion = async (
  userId: number | undefined,
  accion: string,
  entidad: string,
  entidadId: number | undefined,
  payload: any
) => {
  try {
    await prisma.auditoria.create({
      data: {
        // Si userId es undefined, no se incluye en la consulta
        ...(userId !== undefined ? { userId } : {}),
        accion,
        entidad,
        // Si entidadId es undefined, no se incluye en la consulta
        ...(entidadId !== undefined ? { entidadId } : {}),
        payload,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error al registrar auditoría:', error.message)
    } else {
      console.error('Error desconocido al registrar auditoría')
    }
    // No lanzamos el error para que no afecte la operación principal
  }
}
