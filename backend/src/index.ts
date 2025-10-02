import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { env } from './config/env'
import { authRouter } from './modules/auth/router'
import { usuariosRouter } from './modules/usuarios/router'
import { areasRouter } from './modules/areas/router'
import { docentesRouter } from './modules/docentes/router'
import { requireAuth, requireRole } from './middlewares/auth'
import { PrismaClient } from '@prisma/client'

// Crear aplicación Express
const app = express()
const prisma = new PrismaClient()

// Middlewares
app.use(cors())
app.use(helmet())
app.use(express.json())

// Servir archivos estáticos desde la carpeta uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Iniciar servidor
app.get('/', (_, res) => {
    res.json({ message: 'Bienvenido al servidor' })
})

// Rutas
app.use('/api/auth', authRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/areas', areasRouter)
app.use('/api/docentes', docentesRouter)

// Ruta de salud
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/me', requireAuth, (req, res) => {
    // req.user tipado correctamente en estricto
    res.json({ user: req.user })
})

// Iniciar servidor
const PORT = env.server.port
app.listen(PORT, () => {
    console.log(`✅ Servidor iniciado en puerto ${PORT}`)
    console.log(`🌐 Modo: ${env.server.nodeEnv}`)
})
