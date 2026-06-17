import { Router } from 'express'
import { login, googleLogin } from './controller'

export const authRouter = Router()

authRouter.post('/login', login)
authRouter.post('/google', googleLogin)
