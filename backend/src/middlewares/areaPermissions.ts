import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { JwtPayload } from './auth'

const prisma = new PrismaClient()

/**
 * Middleware para verificar si un usuario COORD tiene acceso a un área específica
 * Se debe usar después del middleware requireAuth
 */
export async function requireAreaPermission(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    // Si el usuario es ADMIN o RH, permitir acceso a todas las áreas
    if (user.roles.includes('ADMIN') || user.roles.includes('RH')) {
      return next()
    }

    // Si el usuario es COORD, verificar que tenga acceso al área solicitada
    if (user.roles.includes('COORD')) {
      // Obtener el areaId de los parámetros o del body
      let areaId: number | null = null
      
      if (req.params.areaId) {
        areaId = parseInt(req.params.areaId)
      } else if (req.body.areaId) {
        areaId = parseInt(req.body.areaId)
      } else if (req.query.areaId && typeof req.query.areaId === 'string') {
        areaId = parseInt(req.query.areaId)
      }

      if (!areaId || isNaN(areaId)) {
        return res.status(400).json({ error: 'ID de área no proporcionado o inválido' })
      }

      // Verificar si el usuario tiene asignada el área
      const coordArea = await prisma.coordArea.findFirst({
        where: {
          userId: user.id,
          areaId: areaId
        }
      })

      if (!coordArea) {
        return res.status(403).json({ 
          error: 'No autorizado', 
          mensaje: 'No tienes permiso para acceder a esta área' 
        })
      }
    }

    next()
  } catch (error) {
    console.error('Error al verificar permisos de área:', error)
    return res.status(500).json({ error: 'Error al verificar permisos' })
  }
}
