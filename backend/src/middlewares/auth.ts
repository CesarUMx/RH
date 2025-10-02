import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

// Extender la interfaz JwtPayload de jsonwebtoken
export interface JwtPayload extends jwt.JwtPayload {
  id: number
  correo: string
  roles: string[]
}

// Extender la interfaz Request de Express
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['authorization']
  if (!header) return res.status(401).json({ error: 'Token requerido' })

  const token = header.split(' ')[1]
  // Verificar que el token y el secreto existen
  if (!token || !env.jwtSecret) {
    return res.status(401).json({ error: 'Error de configuración de autenticación' })
  }

  try {
    // Ahora TypeScript sabe que env.jwtSecret no es undefined
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

// Middleware para verificar roles
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' })

    const tiene = req.user.roles.some(r => roles.includes(r))
    if (!tiene) return res.status(403).json({ error: 'No autorizado' })

    next()
  }
}
