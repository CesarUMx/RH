import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  status?: number
  statusCode?: number
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status ?? err.statusCode ?? 500
  const message = err.message || 'Error interno del servidor'

  console.error(`[${new Date().toISOString()}] ${status} - ${message}`, err)

  res.status(status).json({ error: message })
}
