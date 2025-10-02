import type { JwtPayload } from '../../middlewares/auth'

declare global {
  namespace Express {
    interface Request {
      user?: Pick<JwtPayload, 'id' | 'correo' | 'roles'>
    }
  }
}

export {}
