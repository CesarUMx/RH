import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { env } from './config/env'
import { authRouter } from './modules/auth/router'
import { usuariosRouter } from './modules/usuarios/router'
import { areasRouter } from './modules/areas/router'
import { docentesRouter } from './modules/docentes/router'
import { periodosRouter } from './modules/periodos/router'
import { cargaHorasRouter } from './modules/carga-horas/router'
import { requireAuth, requireRole } from './middlewares/auth'
import { PrismaClient } from '@prisma/client'

// Crear aplicación Express
const app = express()
const prisma = new PrismaClient()

// Middlewares
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Orígenes permitidos (puerto por defecto de Vite)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Permite enviar cookies entre orígenes
}))

// Configuración de seguridad con Helmet
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Permite cargar recursos desde otros orígenes
}))

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
app.use('/api/periodos', periodosRouter)
app.use('/api/carga-horas', cargaHorasRouter)

// Ruta de salud
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Ruta para obtener datos del usuario autenticado
app.get('/api/me', requireAuth, (req, res) => {
    console.log('Backend - /api/me - Usuario autenticado:', req.user);
    res.json({ user: req.user })
})

// Ruta alternativa sin prefijo /api para compatibilidad
app.get('/me', requireAuth, (req, res) => {
    console.log('Backend - /me - Usuario autenticado:', req.user);
    res.json({ user: req.user })
})

// Iniciar servidor
const PORT = env.server.port
app.listen(PORT, () => {
    console.log(`✅ Servidor iniciado en puerto ${PORT}`)
    console.log(`🌐 Modo: ${env.server.nodeEnv}`)
})
