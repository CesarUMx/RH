import { Request, Response, NextFunction } from 'express'

/**
 * Rate limit simple en memoria para endpoints de integración
 * Limita a 100 peticiones por minuto por IP
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const WINDOW_MS = 60 * 1000 // 1 minuto
const MAX_REQUESTS = 100

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const now = Date.now()

  const data = requestCounts.get(ip)

  if (!data || now > data.resetTime) {
    // Nueva ventana o expiró
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS })
    return next()
  }

  if (data.count >= MAX_REQUESTS) {
    const resetIn = Math.ceil((data.resetTime - now) / 1000)
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Límite de peticiones excedido. Intenta nuevamente en ${resetIn} segundos.`,
      retryAfter: resetIn,
    })
  }

  data.count++
  next()
}
