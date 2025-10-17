import { PrismaClient } from '@prisma/client'
import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
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
