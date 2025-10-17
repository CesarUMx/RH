import dotenv from 'dotenv'
import { z } from 'zod'

// Cargar variables de entorno desde .env
dotenv.config()

// Esquema de validación para las variables de entorno
const envSchema = z.object({
  // Base de datos
  DATABASE_URL: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(1),

  // Servidor
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
})

// Intentar validar las variables de entorno
const _env = envSchema.safeParse(process.env)

// Si hay errores, mostrarlos y salir
if (!_env.success) {
  console.error('❌ Variables de entorno inválidas:')
  console.error(_env.error.format())
  throw new Error('Variables de entorno inválidas')
}

// Exportar las variables de entorno tipadas
export const env = {
  database: {
    url: _env.data.DATABASE_URL,
  },
  jwtSecret: _env.data.JWT_SECRET,
  server: {
    port: parseInt(_env.data.PORT),
    nodeEnv: _env.data.NODE_ENV,
    isDev: _env.data.NODE_ENV === 'development',
    isProd: _env.data.NODE_ENV === 'production',
    isTest: _env.data.NODE_ENV === 'test',
  },
  cors: {
    allowedOrigins: _env.data.CORS_ALLOWED_ORIGINS.split(','),
  },
}
