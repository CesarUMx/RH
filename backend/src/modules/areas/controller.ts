import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { JwtPayload } from '../../middlewares/auth'

const prisma = new PrismaClient()

// Esquemas de validación
const areaSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  activo: z.boolean().optional().default(true)
})

const areaUpdateSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').optional(),
  activo: z.boolean().optional()
})

const coordAreaSchema = z.object({
  userId: z.number().int().positive('ID de usuario inválido')
})

// GET /areas - Listar todas las áreas
export async function listarAreas(_req: Request, res: Response) {
  try {
    const areas = await prisma.area.findMany({
      select: {
        id: true,
        nombre: true,
        activo: true,
        coordAreas: {
          select: {
            user: {
              select: {
                id: true,
                nombre: true,
                correo: true
              }
            }
          }
        }
      }
    })

    // Transformar la respuesta para simplificar la estructura
    const areasFormateadas = areas.map(area => ({
      id: area.id,
      nombre: area.nombre,
      activo: area.activo,
      coordinadores: area.coordAreas.map(coord => ({
        id: coord.user.id,
        nombre: coord.user.nombre,
        correo: coord.user.correo
      }))
    }))

    return res.json(areasFormateadas)
  } catch (error) {
    console.error('Error al listar áreas:', error)
    return res.status(500).json({ error: 'Error al obtener áreas' })
  }
}

// POST /areas - Crear una nueva área
export async function crearArea(req: Request, res: Response) {
  try {
    // Validar datos de entrada
    const validacion = areaSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { nombre, activo } = validacion.data

    // Verificar que el nombre no exista
    const areaExistente = await prisma.area.findUnique({
      where: { nombre }
    })

    if (areaExistente) {
      return res.status(400).json({ error: 'El nombre del área ya existe' })
    }

    // Crear el área
    const area = await prisma.area.create({
      data: {
        nombre,
        activo
      }
    })

    return res.status(201).json(area)
  } catch (error) {
    console.error('Error al crear área:', error)
    return res.status(500).json({ error: 'Error al crear área' })
  }
}

// PUT /areas/:id - Actualizar un área existente
export async function actualizarArea(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de área requerido' })
    }
    
    const areaId = parseInt(id)

    if (isNaN(areaId)) {
      return res.status(400).json({ error: 'ID de área inválido' })
    }

    // Validar datos de entrada
    const validacion = areaUpdateSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { nombre, activo } = validacion.data

    // Verificar que el área exista
    const areaExistente = await prisma.area.findUnique({
      where: { id: areaId }
    })

    if (!areaExistente) {
      return res.status(404).json({ error: 'Área no encontrada' })
    }

    // Si se está actualizando el nombre, verificar que no exista otro con ese nombre
    if (nombre && nombre !== areaExistente.nombre) {
      const nombreExistente = await prisma.area.findUnique({
        where: { nombre }
      })

      if (nombreExistente) {
        return res.status(400).json({ error: 'El nombre del área ya existe' })
      }
    }

    // Actualizar el área
    const area = await prisma.area.update({
      where: { id: areaId },
      data: {
        ...(nombre && { nombre }),
        ...(activo !== undefined && { activo })
      }
    })

    return res.json(area)
  } catch (error) {
    console.error('Error al actualizar área:', error)
    return res.status(500).json({ error: 'Error al actualizar área' })
  }
}

// DELETE /areas/:id - Eliminar un área
export async function eliminarArea(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de área requerido' })
    }
    
    const areaId = parseInt(id)

    if (isNaN(areaId)) {
      return res.status(400).json({ error: 'ID de área inválido' })
    }

    // Verificar que el área exista
    const areaExistente = await prisma.area.findUnique({
      where: { id: areaId },
      include: { coordAreas: true, cargas: true }
    })

    if (!areaExistente) {
      return res.status(404).json({ error: 'Área no encontrada' })
    }

    // Verificar si tiene coordinadores o cargas asociadas
    if (areaExistente.coordAreas.length > 0 || areaExistente.cargas.length > 0) {
      // En lugar de eliminar, marcar como inactiva
      await prisma.area.update({
        where: { id: areaId },
        data: { activo: false }
      })

      return res.json({ 
        mensaje: 'Área marcada como inactiva porque tiene coordinadores o cargas asociadas' 
      })
    }

    // Si no tiene dependencias, eliminar completamente
    await prisma.area.delete({
      where: { id: areaId }
    })

    return res.json({ mensaje: 'Área eliminada correctamente' })
  } catch (error) {
    console.error('Error al eliminar área:', error)
    return res.status(500).json({ error: 'Error al eliminar área' })
  }
}

// GET /areas/:id/coordinadores - Listar coordinadores de un área
export async function listarCoordinadores(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de área requerido' })
    }
    
    const areaId = parseInt(id)

    if (isNaN(areaId)) {
      return res.status(400).json({ error: 'ID de área inválido' })
    }

    // Verificar que el área exista
    const areaExistente = await prisma.area.findUnique({
      where: { id: areaId }
    })

    if (!areaExistente) {
      return res.status(404).json({ error: 'Área no encontrada' })
    }

    // Obtener coordinadores
    const coordinadores = await prisma.coordArea.findMany({
      where: { areaId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            correo: true,
            activo: true,
            roles: {
              include: {
                role: true
              }
            }
          }
        }
      }
    })

    // Transformar la respuesta
    const coordinadoresFormateados = coordinadores.map(coord => ({
      id: coord.user.id,
      nombre: coord.user.nombre,
      correo: coord.user.correo,
      activo: coord.user.activo,
      roles: coord.user.roles.map(r => r.role.nombre)
    }))

    return res.json(coordinadoresFormateados)
  } catch (error) {
    console.error('Error al listar coordinadores:', error)
    return res.status(500).json({ error: 'Error al obtener coordinadores' })
  }
}

// POST /areas/:id/coordinadores - Asignar un coordinador a un área
export async function asignarCoordinador(req: Request, res: Response) {
  try {
    const { id } = req.params
    
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de área requerido' })
    }
    
    const areaId = parseInt(id)

    if (isNaN(areaId)) {
      return res.status(400).json({ error: 'ID de área inválido' })
    }

    // Validar datos de entrada
    const validacion = coordAreaSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { userId } = validacion.data

    // Verificar que el área exista
    const areaExistente = await prisma.area.findUnique({
      where: { id: areaId }
    })

    if (!areaExistente) {
      return res.status(404).json({ error: 'Área no encontrada' })
    }

    // Verificar que el usuario exista
    const usuarioExistente = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    })

    if (!usuarioExistente) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // Verificar que el usuario tenga el rol COORD
    const esCoordinador = usuarioExistente.roles.some(r => r.role.nombre === 'COORD')
    if (!esCoordinador) {
      return res.status(403).json({ 
        error: 'El usuario debe tener el rol COORD para ser asignado como coordinador' 
      })
    }

    // Verificar que no exista ya la asignación
    const asignacionExistente = await prisma.coordArea.findFirst({
      where: {
        userId,
        areaId
      }
    })

    if (asignacionExistente) {
      return res.status(400).json({ error: 'El usuario ya es coordinador de esta área' })
    }

    // Crear la asignación
    await prisma.coordArea.create({
      data: {
        user: { connect: { id: userId } },
        area: { connect: { id: areaId } }
      }
    })

    return res.status(201).json({ 
      mensaje: 'Coordinador asignado correctamente',
      usuario: {
        id: usuarioExistente.id,
        nombre: usuarioExistente.nombre,
        correo: usuarioExistente.correo
      },
      area: {
        id: areaExistente.id,
        nombre: areaExistente.nombre
      }
    })
  } catch (error) {
    console.error('Error al asignar coordinador:', error)
    return res.status(500).json({ error: 'Error al asignar coordinador' })
  }
}

// DELETE /areas/:id/coordinadores/:userId - Eliminar un coordinador de un área
export async function eliminarCoordinador(req: Request, res: Response) {
  try {
    const { id, userId } = req.params
    
    // Aseguramos que los parámetros no sean undefined
    if (!id) {
      return res.status(400).json({ error: 'ID de área requerido' })
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'ID de usuario requerido' })
    }
    
    const areaId = parseInt(id)
    const userIdNum = parseInt(userId)

    if (isNaN(areaId)) {
      return res.status(400).json({ error: 'ID de área inválido' })
    }

    if (isNaN(userIdNum)) {
      return res.status(400).json({ error: 'ID de usuario inválido' })
    }

    // Verificar que exista la asignación
    const asignacion = await prisma.coordArea.findFirst({
      where: {
        userId: userIdNum,
        areaId
      }
    })

    if (!asignacion) {
      return res.status(404).json({ error: 'El usuario no es coordinador de esta área' })
    }

    // Eliminar la asignación
    await prisma.coordArea.delete({
      where: { id: asignacion.id }
    })

    return res.json({ mensaje: 'Coordinador eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar coordinador:', error)
    return res.status(500).json({ error: 'Error al eliminar coordinador' })
  }
}

// GET /mis-areas - Obtener áreas asignadas al usuario actual con rol COORD
export async function misAreas(req: Request, res: Response) {
  try {
    const user = req.user as JwtPayload
    
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Verificar si el usuario tiene rol COORD
    const tieneRolCoord = user.roles.includes('COORD')
    if (!tieneRolCoord) {
      return res.status(403).json({ 
        error: 'El usuario no tiene el rol de Coordinador',
        mensaje: 'Se requiere el rol COORD para acceder a esta funcionalidad'
      })
    }

    // Obtener las áreas asignadas al usuario
    const areasAsignadas = await prisma.coordArea.findMany({
      where: { userId: user.id },
      include: {
        area: true
      }
    })

    // Transformar la respuesta
    const areas = areasAsignadas.map(asignacion => ({
      id: asignacion.area.id,
      nombre: asignacion.area.nombre,
      activo: asignacion.area.activo
    }))

    return res.json(areas)
  } catch (error) {
    console.error('Error al obtener áreas asignadas:', error)
    return res.status(500).json({ error: 'Error al obtener áreas asignadas' })
  }
}
