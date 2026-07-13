import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { env } from '../config/env'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoEmpleado = 'DOCENTE' | 'EMPLEADO'

export interface PartesNombre {
  primerNombre: string
  segundoNombre?: string
  primerApellido: string
  segundoApellido?: string
}

// ─── Utilidades internas ──────────────────────────────────────────────────────

function normalizar(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
}

function getAdminClient() {
  const { serviceAccountEmail, privateKey, adminEmail } = env.google.workspace
  if (!serviceAccountEmail || !privateKey || !adminEmail) {
    throw new Error('Credenciales de Google Workspace no configuradas. Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY y GOOGLE_ADMIN_EMAIL en .env')
  }
  const auth = new JWT({
    email: serviceAccountEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
    subject: adminEmail,
  })
  // JWT from google-auth-library is compatible at runtime but requires cast for strict TS
  return google.admin({ version: 'directory_v1', auth: auth as any })
}

// ─── Generación de correo ─────────────────────────────────────────────────────

/**
 * Genera hasta 3 candidatos de correo según el tipo de empleado y partes del nombre.
 * Tipo DOCENTE:  primer_nombre.primer_apellido
 * Tipo EMPLEADO: inicial_primer_nombre + primer_apellido
 */
export function generarCandidatosCorreo(
  partes: PartesNombre,
  tipo: TipoEmpleado,
  dominio: string = env.google.workspace.domain
): string[] {
  const fn = normalizar(partes.primerNombre)
  const sn = partes.segundoNombre ? normalizar(partes.segundoNombre) : null
  const pa = normalizar(partes.primerApellido)
  const sa = partes.segundoApellido ? normalizar(partes.segundoApellido) : null

  const candidatos: string[] = []

  if (tipo === 'DOCENTE') {
    // Candidato 1: cesar.ortiz
    candidatos.push(`${fn}.${pa}@${dominio}`)
    // Candidato 2: cesar.ortizperez (si hay segundo apellido)
    if (sa) candidatos.push(`${fn}.${pa}${sa}@${dominio}`)
    // Candidato 3: cesare.ortiz (inicial segundo nombre, si hay)
    if (sn) candidatos.push(`${fn}${sn[0]}.${pa}@${dominio}`)
  } else {
    // Candidato 1: cortiz  (inicial primerNombre + primerApellido)
    candidatos.push(`${fn[0]}${pa}@${dominio}`)
    // Candidato 2: cescobar  (inicial primerNombre + segundoApellido — reemplaza primerApellido)
    if (sa) candidatos.push(`${fn[0]}${sa}@${dominio}`)
    // Candidato 3: eortiz   (inicial segundoNombre + primerApellido — reemplaza primerNombre)
    if (sn) candidatos.push(`${sn[0]}${pa}@${dominio}`)
  }

  return candidatos
}

// ─── Verificación de disponibilidad ──────────────────────────────────────────

/**
 * Verifica si un correo está disponible en Google Workspace.
 * Retorna true si está disponible (no existe), false si ya está en uso.
 */
export async function verificarDisponibilidadCorreo(correo: string): Promise<boolean> {
  try {
    const admin = getAdminClient()
    await admin.users.get({ userKey: correo })
    // Si no lanza error, el usuario ya existe → no disponible
    return false
  } catch (err: any) {
    if (err?.code === 404 || err?.response?.status === 404) {
      return true // disponible
    }
    // Otro error (auth, network, etc.) → relanzar
    throw err
  }
}

// ─── Generación de contraseña ─────────────────────────────────────────────────

const LETRAS = 'abcdefghijklmnopqrstuvwxyz'
const ALFANUM = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function generarPassword(): string {
  const { randomBytes } = require('crypto')
  const bytesLetras = randomBytes(5)
  const bytesAlfanum = randomBytes(4)

  const palabra = Array.from(bytesLetras as Uint8Array)
    .map((b: number) => LETRAS[b % LETRAS.length])
    .join('')

  const codigo = Array.from(bytesAlfanum as Uint8Array)
    .map((b: number) => ALFANUM[b % ALFANUM.length])
    .join('')

  return `${palabra}-${codigo}`
}

// ─── Operaciones sobre usuarios ───────────────────────────────────────────────

export async function crearUsuarioWorkspace(
  correo: string,
  primerNombre: string,
  apellido: string,
  password: string
): Promise<void> {
  const admin = getAdminClient()
  await admin.users.insert({
    requestBody: {
      primaryEmail: correo,
      name: {
        givenName: primerNombre,
        familyName: apellido,
      },
      password,
      changePasswordAtNextLogin: true,
    },
  })
}

export async function suspenderUsuarioWorkspace(correo: string): Promise<void> {
  const admin = getAdminClient()
  await admin.users.update({
    userKey: correo,
    requestBody: { suspended: true },
  })
}

export async function activarUsuarioWorkspace(correo: string): Promise<void> {
  const admin = getAdminClient()
  await admin.users.update({
    userKey: correo,
    requestBody: { suspended: false },
  })
}
