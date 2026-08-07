import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'

/**
 * Middleware para autenticar peticiones de integración externa
 * mediante API Key en el header X-API-Key
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string

  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API Key requerida',
      message: 'El header X-API-Key es obligatorio' 
    })
  }

  if (apiKey !== env.integration.apiKey) {
    return res.status(403).json({ 
      error: 'API Key inválida',
      message: 'La API Key proporcionada no es válida' 
    })
  }

  next()
}
