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
import { pagosRouter } from './modules/pagos/router'
import { solicitudesRouter } from './modules/solicitudes/router'
import { expedientesRouter } from './modules/expedientes/router'
import { contratosRouter } from './modules/contratos/router'
import { requireAuth } from './middlewares/auth'
import { PrismaClient } from '@prisma/client'
import { inicializarCronJobs } from './services/cron.service'

// Crear aplicación Express
const app = express()
const prisma = new PrismaClient()

// Middlewares
app.use(cors({
    origin: env.cors.allowedOrigins, // Orígenes permitidos (puerto por defecto de Vite)
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
app.use('/api/pagos', pagosRouter)
app.use('/api/solicitudes', solicitudesRouter)
app.use('/api/expedientes', expedientesRouter)
app.use('/api/contratos', contratosRouter)

// Ruta de salud
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Ruta para obtener datos del usuario autenticado
app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: req.user })
})

// Ruta alternativa sin prefijo /api para compatibilidad
app.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user })
})

// Iniciar servidor
const PORT = env.server.port
app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`)
    console.log(`Modo: ${env.server.nodeEnv}`)
    
    // Inicializar tareas programadas (Cron Jobs)
    inicializarCronJobs()
})
