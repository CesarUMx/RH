import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env'
import { authRouter } from './modules/auth/router'
import { requireAuth, requireRole } from './middlewares/auth'
import { PrismaClient } from '@prisma/client'

// Crear aplicación Express
const app = express()
const prisma = new PrismaClient()

// Middlewares
app.use(cors())
app.use(helmet())
app.use(express.json())

// Iniciar servidor
app.get('/', (_, res) => {
    res.json({ message: 'Bienvenido al servidor' })
})

// Rutas
app.use('/api/auth', authRouter)

// Ruta de salud
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/me', requireAuth, (req, res) => {
    // req.user tipado correctamente en estricto
    res.json({ user: req.user })
})

app.get('/usuarios', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
    const usuarios = await prisma.user.findMany({
        include: { roles: { include: { role: true } } }
    })
    res.json(usuarios)
})

// Iniciar servidor
const PORT = env.server.port
app.listen(PORT, () => {
    console.log(`✅ Servidor iniciado en puerto ${PORT}`)
    console.log(`🌐 Modo: ${env.server.nodeEnv}`)
})
