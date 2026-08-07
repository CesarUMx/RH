import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const buscarSchema = z.object({
  q: z.string().min(1).max(100),
})

/**
 * GET /api/v1/integracion/buscar-empleado
 * Busca empleados por nombre, correo o número de colaborador
 * 
 * @param q - Término de búsqueda (nombre, correo o numColaborador)
 * @returns Lista de empleados con datos básicos
 */
export async function buscarEmpleado(req: Request, res: Response) {
  try {
    const validacion = buscarSchema.safeParse(req.query)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        detalles: validacion.error.format() 
      })
    }

    const { q } = validacion.data

    const empleados = await prisma.user.findMany({
      where: {
        activo: true,
        roles: { some: { role: { nombre: 'EMPLEADO' } } },
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { correo: { contains: q, mode: 'insensitive' } },
          { registroIngreso: { numColaborador: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        registroIngreso: {
          select: {
            numColaborador: true,
            puesto: true,
            tipo: true,
          },
        },
      },
      take: 20, // Limitar resultados
    })

    const data = empleados.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      correo: e.correo,
      numColaborador: e.registroIngreso?.numColaborador ?? null,
      puesto: e.registroIngreso?.puesto ?? null,
      tipo: e.registroIngreso?.tipo ?? null,
    }))

    return res.json({
      success: true,
      count: data.length,
      data,
    })
  } catch (error) {
    console.error('[Integración] Error al buscar empleado:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    })
  }
}
