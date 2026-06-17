import { PrismaClient } from '@prisma/client'
import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { env } from '../../config/env'

const prisma = new PrismaClient()

type LoginBody = {
  correo: string
  password: string
}

export async function login(req: Request<unknown, unknown, LoginBody>, res: Response) {
  try {
    const { correo, password } = req.body ?? {}

    if (!correo || !password) {
      return res.status(400).json({ error: 'Faltan campos: correo y password' })
    }

    const user = await prisma.user.findUnique({
      where: { correo },
      include: { roles: { include: { role: true } } }
    })

    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' })

    const roles = user.roles.map(r => r.role.nombre)

    const token = jwt.sign(
      { id: user.id, correo: user.correo, roles },
      env.jwtSecret,
      { expiresIn: '8h' }
    )

    return res.json({ token })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Error interno' })
  }
}

export async function googleLogin(req: Request, res: Response) {
  const { token } = req.body ?? {}

  if (!token) {
    return res.status(400).json({ error: 'Token requerido' })
  }

  const clientId = env.google.clientId
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth no está configurado en el servidor' })
  }

  try {
    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({ idToken: token, audience: clientId })
    const payload = ticket.getPayload()

    if (!payload?.email) {
      return res.status(400).json({ error: 'Token de Google inválido' })
    }

    const user = await prisma.user.findUnique({
      where: { correo: payload.email },
      include: { roles: { include: { role: true } } }
    })

    if (!user) {
      return res.status(401).json({ error: 'El correo no está registrado en el sistema' })
    }

    if (!user.activo) {
      return res.status(403).json({ error: 'Usuario inactivo' })
    }

    const roles = user.roles.map(r => r.role.nombre)
    const jwtToken = jwt.sign(
      { id: user.id, correo: user.correo, roles },
      env.jwtSecret,
      { expiresIn: '8h' }
    )

    return res.json({ token: jwtToken })
  } catch (err) {
    console.error('Google login error:', err)
    return res.status(401).json({ error: 'Token de Google inválido o expirado' })
  }
}
