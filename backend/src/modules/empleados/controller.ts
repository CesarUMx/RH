import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import path from 'path'
import fs from 'fs'
import { JwtPayload } from '../../middlewares/auth'
import { auditarAccion } from '../../utils/auditoria'
import { sendEmail, emailTemplates } from '../../services/email.service'
import { generarArchivoCredenciales } from '../../services/credenciales.service'
import {
  generarCandidatosCorreo,
  verificarDisponibilidadCorreo,
  crearUsuarioWorkspace,
  suspenderUsuarioWorkspace,
  generarPassword,
  PartesNombre,
  TipoEmpleado,
} from '../../services/googleWorkspace.service'

const prisma = new PrismaClient()

// ─── Schemas ──────────────────────────────────────────────────────────────────

const sugerirSchema = z.object({
  primerNombre: z.string().min(1),
  segundoNombre: z.string().optional(),
  primerApellido: z.string().min(1),
  segundoApellido: z.string().optional(),
  // Acepta tanto el enum de colaborador como el legacy DOCENTE/EMPLEADO
  tipo: z.enum(['ADMINISTRATIVO', 'GUARDIA', 'LIMPIEZA_MANTENIMIENTO', 'DOCENTE', 'EMPLEADO']),
})

const TIPOS_COLABORADOR = ['ADMINISTRATIVO', 'GUARDIA', 'LIMPIEZA_MANTENIMIENTO', 'DOCENTE'] as const

const crearEmpleadoSchema = z.object({
  // Datos HR
  nombre: z.string().min(2),
  tipo: z.enum(TIPOS_COLABORADOR),
  fechaNacimiento: z.string().min(1),
  numColaborador: z.string().min(1),
  fechaIngreso: z.string().min(1),
  puesto: z.string().min(2),
  // Datos para correo institucional (solo requerido para DOCENTE)
  primerNombre: z.string().min(1),
  segundoNombre: z.string().optional(),
  primerApellido: z.string().min(1),
  segundoApellido: z.string().optional(),
  correoInstitucional: z.string().email(),
  // Departamento
  departamentoId: z.number().int().positive(),
  // Destinatarios adicionales del correo de alta (opcional)
  destinatariosExtra: z.array(z.string().email()).optional().default([]),
  esExtranjero: z.boolean().optional().default(false),
})

// ─── POST /empleados/sugerir-correo ──────────────────────────────────────────

export async function sugerirCorreo(req: Request, res: Response) {
  try {
    const validacion = sugerirSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: validacion.error.format() })
    }
    const { primerNombre, segundoNombre, primerApellido, segundoApellido, tipo } = validacion.data
    const partes: PartesNombre = {
      primerNombre,
      primerApellido,
      ...(segundoNombre ? { segundoNombre } : {}),
      ...(segundoApellido ? { segundoApellido } : {}),
    }
    // DOCENTE usa formato nombre.apellido; todos los demás usan inicial+apellido
    const tipoCorreo: TipoEmpleado = tipo === 'DOCENTE' ? 'DOCENTE' : 'EMPLEADO'
    const candidatos = generarCandidatosCorreo(partes, tipoCorreo)

    const resultados: { correo: string; disponible: boolean }[] = []
    for (const correo of candidatos) {
      try {
        const disponible = await verificarDisponibilidadCorreo(correo)
        resultados.push({ correo, disponible })
      } catch {
        resultados.push({ correo, disponible: true })
      }
    }
    return res.json({ candidatos: resultados })
  } catch (error) {
    console.error('Error al sugerir correo:', error)
    return res.status(500).json({ error: 'Error al generar sugerencias' })
  }
}

// ─── POST /empleados ──────────────────────────────────────────────────────────

export async function crearEmpleado(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const validacion = crearEmpleadoSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: validacion.error.format() })
    }

    const {
      nombre, tipo, fechaNacimiento, numColaborador, fechaIngreso, puesto,
      primerNombre, segundoNombre, primerApellido, segundoApellido,
      correoInstitucional, departamentoId, destinatariosExtra, esExtranjero,
    } = validacion.data

    // Nombre completo para Google Workspace
    const gwGivenName = [primerNombre, segundoNombre].filter(Boolean).join(' ')
    const gwFamilyName = [primerApellido, segundoApellido].filter(Boolean).join(' ')

    // Verificar que el correo no exista ya en BD
    const correoEnBD = await prisma.user.findUnique({ where: { correo: correoInstitucional } })
    if (correoEnBD) return res.status(400).json({ error: 'El correo institucional ya está registrado en el sistema' })

    const cuentaEnBD = await prisma.cuentaInstitucional.findUnique({ where: { correoInstitucional } })
    if (cuentaEnBD) return res.status(400).json({ error: 'El correo institucional ya está asignado a otra cuenta' })

    // Verificar departamento y obtener coordinador
    const departamento = await prisma.departamento.findUnique({
      where: { id: departamentoId },
      include: { coordinador: { select: { correo: true, nombre: true } } },
    })
    if (!departamento) return res.status(404).json({ error: 'Departamento no encontrado' })

    // Generar contraseña
    const password = generarPassword()

    // 1. Crear cuenta en Google Workspace
    try {
      await crearUsuarioWorkspace(correoInstitucional, gwGivenName, gwFamilyName, password)
    } catch (gwError: any) {
      console.error('Error Google Workspace:', gwError)
      return res.status(502).json({
        error: 'No se pudo crear la cuenta en Google Workspace',
        detalle: gwError?.message ?? 'Error desconocido',
      })
    }

    // 2. Crear User(EMPLEADO) en el sistema con el correo institucional
    const roleEmpleado = await prisma.role.findUnique({ where: { nombre: 'EMPLEADO' } })
    if (!roleEmpleado) return res.status(500).json({ error: 'Rol EMPLEADO no encontrado en el sistema' })

    const passwordHash = await bcrypt.hash(password, 10)
    const nuevoUser = await prisma.user.create({
      data: {
        nombre,
        correo: correoInstitucional,
        password: passwordHash,
        roles: { create: { roleId: roleEmpleado.id } },
      },
    })

    // 3. Crear CuentaInstitucional
    const cuenta = await prisma.cuentaInstitucional.create({
      data: {
        userId: nuevoUser.id,
        correoInstitucional,
        departamentoId,
        creadoPorId: actor.id,
      },
    })

    // 4. Generar archivo Excel de credenciales
    const archivoCredenciales = await generarArchivoCredenciales(
      nombre, correoInstitucional, password, nuevoUser.id
    )

    // 5. Crear RegistroIngreso
    await prisma.registroIngreso.create({
      data: {
        userId: nuevoUser.id,
        nombre,
        tipo,
        fechaNacimiento: new Date(fechaNacimiento),
        numColaborador,
        fechaIngreso: new Date(fechaIngreso),
        puesto,
        archivoCredenciales,
        creadoPorId: actor.id,
        esExtranjero: esExtranjero ?? false,
      },
    })

    // 6. Enviar correo de notificación (best-effort)
    const fnFormatDate = (d: string) =>
      new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()

    const htmlEmail = emailTemplates.ingresoEmpleado(
      nombre.toUpperCase(),
      fnFormatDate(fechaNacimiento),
      numColaborador,
      fnFormatDate(fechaIngreso),
      puesto.toUpperCase()
    )

    const destinatarios = [...new Set([
      'cortiz@mondragonmexico.edu.mx',
      ...(destinatariosExtra ?? []),
    ])]

    try {
      for (const dest of destinatarios) {
        await sendEmail({
          to: dest,
          subject: `Ingreso de nuevo colaborador - ${nombre}`,
          html: htmlEmail,
        })
      }
    } catch (mailErr) {
      console.error('Error al enviar correo de ingreso (best-effort):', mailErr)
    }

    await auditarAccion(actor.id, 'CREAR_EMPLEADO', 'User', nuevoUser.id, {
      correoInstitucional, departamentoId, numColaborador,
    })

    // 7. Si es GUARDIA, crear acceso en SICAV (best-effort)
    if (tipo === 'GUARDIA') {
      const { env: envConfig } = await import('../../config/env')
      if (envConfig.sicav.apiKey) {
        try {
          const username = correoInstitucional.split('@')[0] ?? correoInstitucional
          const sicavPayload = {
            username,
            name: nombre,
            email: correoInstitucional,
            role: 'guardia',
            guardType: 'entrada',
            password,
            sendCredentials: false,
          }
          console.log('[SICAV] Enviando petición:', JSON.stringify(sicavPayload, null, 2))

          const sicavRes = await fetch(`${envConfig.sicav.baseUrl}/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': envConfig.sicav.apiKey,
            },
            body: JSON.stringify(sicavPayload),
          })

          const sicavBody = await sicavRes.text()
          console.log(`[SICAV] Respuesta HTTP ${sicavRes.status}:`, sicavBody)

          if (!sicavRes.ok) {
            console.error(`[SICAV] Error al crear usuario en SICAV (${sicavRes.status}):`, sicavBody)
          } else {
            console.log('[SICAV] Usuario creado exitosamente en SICAV')
          }
        } catch (sicavErr) {
          console.error('[SICAV] Error de conexión (best-effort):', sicavErr)
        }
      } else {
        console.warn('SICAV: SICAV_API_KEY no configurada, se omite la creación en SICAV')
      }
    }

    return res.status(201).json({
      user: { id: nuevoUser.id, nombre, correo: correoInstitucional },
      cuenta: { id: cuenta.id, correoInstitucional },
      passwordTemporal: password,
      archivoCredenciales,
    })
  } catch (error) {
    console.error('Error al crear empleado:', error)
    return res.status(500).json({ error: 'Error al crear empleado' })
  }
}

// ─── GET /empleados ───────────────────────────────────────────────────────────
// Devuelve TODOS los User con rol EMPLEADO, mergeando datos de RegistroIngreso
// cuando existan. Los usuarios creados manualmente (sin RegistroIngreso) aparecen
// con campos HR en null.

export async function listarEmpleados(req: Request, res: Response) {
  try {
    const { q, tipo, page = '1', pageSize = '15' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page))
    const size = Math.min(100, Math.max(1, parseInt(pageSize)))
    const skip = (pageNum - 1) * size

    // Filtro de búsqueda sobre campos de User y RegistroIngreso
    const whereUser: any = {
      activo: true,
      roles: { some: { role: { nombre: 'EMPLEADO' } } },
    }

    if (q) {
      whereUser.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { correo: { contains: q, mode: 'insensitive' } },
        { registroIngreso: { numColaborador: { contains: q, mode: 'insensitive' } } },
        { registroIngreso: { puesto: { contains: q, mode: 'insensitive' } } },
      ]
    }

    if (tipo && TIPOS_COLABORADOR.includes(tipo as any)) {
      whereUser.registroIngreso = { ...(whereUser.registroIngreso ?? {}), tipo: tipo as any }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereUser,
        skip,
        take: size,
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          correo: true,
          activo: true,
          createdAt: true,
          registroIngreso: {
            select: {
              id: true,
              tipo: true,
              fechaNacimiento: true,
              numColaborador: true,
              fechaIngreso: true,
              puesto: true,
              archivoCredenciales: true,
              creadoEn: true,
              creadoPor: { select: { id: true, nombre: true } },
              esExtranjero: true,
            },
          },
          cuenta: { select: { departamentoId: true } },
        },
      }),
      prisma.user.count({ where: whereUser }),
    ])

    // Normalizar a forma plana compatible con el frontend
    const data = users.map((u) => ({
      id: u.registroIngreso?.id ?? null,
      userId: u.id,
      nombre: u.nombre,
      correo: u.correo,
      activo: u.activo,
      tipo: u.registroIngreso?.tipo ?? null,
      esExtranjero: u.registroIngreso?.esExtranjero ?? false,
      fechaNacimiento: u.registroIngreso?.fechaNacimiento ?? null,
      numColaborador: u.registroIngreso?.numColaborador ?? null,
      fechaIngreso: u.registroIngreso?.fechaIngreso ?? null,
      puesto: u.registroIngreso?.puesto ?? null,
      archivoCredenciales: u.registroIngreso?.archivoCredenciales ?? null,
      creadoEn: u.registroIngreso?.creadoEn ?? u.createdAt,
      creadoPor: u.registroIngreso?.creadoPor ?? null,
      tieneRegistro: !!u.registroIngreso,
      departamentoId: u.cuenta?.departamentoId ?? null,
    }))

    return res.json({
      data,
      pagination: { total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) },
    })
  } catch (error) {
    console.error('Error al listar empleados:', error)
    return res.status(500).json({ error: 'Error al obtener empleados' })
  }
}

// ─── GET /empleados/exportar ──────────────────────────────────────────────────
// Descarga CSV de todos los empleados con los filtros activos

export async function exportarEmpleados(req: Request, res: Response) {
  try {
    const { q, tipo } = req.query as Record<string, string>

    const whereUser: any = {
      activo: true,
      roles: { some: { role: { nombre: 'EMPLEADO' } } },
    }

    if (q) {
      whereUser.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { correo: { contains: q, mode: 'insensitive' } },
        { registroIngreso: { numColaborador: { contains: q, mode: 'insensitive' } } },
        { registroIngreso: { puesto: { contains: q, mode: 'insensitive' } } },
      ]
    }

    if (tipo && TIPOS_COLABORADOR.includes(tipo as any)) {
      whereUser.registroIngreso = { ...(whereUser.registroIngreso ?? {}), tipo: tipo as any }
    }

    const users = await prisma.user.findMany({
      where: whereUser,
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        correo: true,
        registroIngreso: {
          select: {
            tipo: true,
            numColaborador: true,
            puesto: true,
            fechaIngreso: true,
            fechaNacimiento: true,
          },
        },
      },
    })

    const TIPO_LABEL: Record<string, string> = {
      ADMINISTRATIVO: 'Administrativo',
      GUARDIA: 'Guardia',
      LIMPIEZA_MANTENIMIENTO: 'Limpieza y Mantenimiento',
      DOCENTE: 'Docente',
    }

    const encabezado = ['ID', 'Nombre', 'Correo', 'Tipo', 'No. Colaborador', 'Puesto', 'Fecha Ingreso', 'Fecha Nacimiento']
    const filas = users.map((u) => [
      u.id,
      `"${u.nombre}"`,
      u.correo,
      TIPO_LABEL[u.registroIngreso?.tipo ?? ''] ?? '—',
      u.registroIngreso?.numColaborador ?? '—',
      `"${u.registroIngreso?.puesto ?? '—'}"`,
      u.registroIngreso?.fechaIngreso
        ? new Date(u.registroIngreso.fechaIngreso).toLocaleDateString('es-MX')
        : '—',
      u.registroIngreso?.fechaNacimiento
        ? new Date(u.registroIngreso.fechaNacimiento).toLocaleDateString('es-MX')
        : '—',
    ])

    const csv = [encabezado.join(','), ...filas.map((f) => f.join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="empleados-${Date.now()}.csv"`)
    return res.send('\uFEFF' + csv) // BOM para Excel
  } catch (error) {
    console.error('Error al exportar empleados:', error)
    return res.status(500).json({ error: 'Error al exportar empleados' })
  }
}

// ─── GET /empleados/:userId/credenciales ─────────────────────────────────────

export async function descargarCredenciales(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId ?? '0')
    if (isNaN(userId) || userId <= 0) return res.status(400).json({ error: 'ID inválido' })

    const registro = await prisma.registroIngreso.findUnique({ where: { userId } })
    if (!registro || !registro.archivoCredenciales) {
      return res.status(404).json({ error: 'No se encontraron credenciales para este empleado' })
    }

    const filepath = path.join(process.cwd(), registro.archivoCredenciales)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Archivo de credenciales no encontrado en el servidor' })
    }

    res.setHeader('Content-Disposition', `attachment; filename="credenciales-${registro.nombre.replace(/\s+/g, '-')}.pdf"`)
    res.setHeader('Content-Type', 'application/pdf')
    return res.sendFile(filepath)
  } catch (error) {
    console.error('Error al descargar credenciales:', error)
    return res.status(500).json({ error: 'Error al descargar credenciales' })
  }
}

// ─── GET /empleados/mis-credenciales (EMPLEADO autenticado) ──────────────────

export async function misCredenciales(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const registro = await prisma.registroIngreso.findUnique({ where: { userId: actor.id } })
    if (!registro || !registro.archivoCredenciales) {
      return res.status(404).json({ error: 'No tienes un archivo de credenciales disponible' })
    }

    const filepath = path.join(process.cwd(), registro.archivoCredenciales)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' })
    }

    res.setHeader('Content-Disposition', `attachment; filename="mis-credenciales.pdf"`)
    res.setHeader('Content-Type', 'application/pdf')
    return res.sendFile(filepath)
  } catch (error) {
    console.error('Error al obtener mis credenciales:', error)
    return res.status(500).json({ error: 'Error al obtener credenciales' })
  }
}

// ─── GET /empleados/mis-credenciales/existe (check si tiene archivo) ─────────

export async function tieneCredenciales(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const registro = await prisma.registroIngreso.findUnique({
      where: { userId: actor.id },
      select: { archivoCredenciales: true },
    })
    return res.json({ tiene: !!(registro?.archivoCredenciales) })
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar credenciales' })
  }
}

// ─── PATCH /empleados/:userId (RH/ADMIN actualiza datos del empleado) ──────────

export async function actualizarEmpleado(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const userId = parseInt(req.params.userId ?? '')
    if (isNaN(userId)) return res.status(400).json({ error: 'userId inválido' })

    const schema = z.object({
      primerNombre:   z.string().min(1).optional(),
      segundoNombre:  z.string().optional(),
      primerApellido: z.string().min(1).optional(),
      segundoApellido: z.string().optional(),
      tipo:           z.enum(['ADMINISTRATIVO', 'GUARDIA', 'LIMPIEZA_MANTENIMIENTO', 'DOCENTE']).optional(),
      fechaNacimiento: z.string().optional(),
      numColaborador:  z.string().optional(),
      fechaIngreso:    z.string().optional(),
      puesto:          z.string().optional(),
      departamentoId:  z.number().int().optional(),
      password:        z.string().min(6).optional(),
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().formErrors[0] ?? 'Datos inválidos' })

    const data = parsed.data

    const registro = await prisma.registroIngreso.findUnique({ where: { userId } })

    // Construir nombre completo si se mandan partes
    const partes = {
      primerNombre:   data.primerNombre   ?? '',
      segundoNombre:  data.segundoNombre  ?? '',
      primerApellido: data.primerApellido ?? '',
      segundoApellido: data.segundoApellido ?? '',
    }
    const nombreNuevo = [partes.primerNombre, partes.segundoNombre, partes.primerApellido, partes.segundoApellido]
      .filter(Boolean).join(' ')

    // Nombre base: el nuevo si se manda, si no el del registro o el del User
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { nombre: true } })
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    const nombreBase = nombreNuevo || registro?.nombre || user.nombre

    const registroData: Record<string, any> = { nombre: nombreBase }
    if (data.tipo)            registroData.tipo            = data.tipo
    if (data.numColaborador)  registroData.numColaborador  = data.numColaborador
    if (data.puesto)          registroData.puesto          = data.puesto
    if (data.fechaNacimiento) registroData.fechaNacimiento = new Date(data.fechaNacimiento)
    if (data.fechaIngreso)    registroData.fechaIngreso    = new Date(data.fechaIngreso)

    await prisma.$transaction(async (tx) => {
      await tx.registroIngreso.upsert({
        where: { userId },
        update: registroData,
        create: {
          userId,
          creadoPorId: actor.id,
          nombre:          nombreBase,
          tipo:            (data.tipo ?? 'ADMINISTRATIVO') as any,
          fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : new Date('1900-01-01'),
          numColaborador:  data.numColaborador  ?? '',
          fechaIngreso:    data.fechaIngreso    ? new Date(data.fechaIngreso)    : new Date(),
          puesto:          data.puesto          ?? '',
        },
      })
      const userUpdate: Record<string, any> = {}
      if (nombreNuevo) userUpdate.nombre = nombreNuevo
      if (data.password) userUpdate.password = await bcrypt.hash(data.password, 10)
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userUpdate })
      }
      if (data.departamentoId) {
        await tx.cuentaInstitucional.updateMany({
          where: { userId },
          data: { departamentoId: data.departamentoId },
        })
      }
    })

    await auditarAccion(actor.id, 'ACTUALIZAR_EMPLEADO', 'RegistroIngreso', registro?.id ?? 0, data)

    return res.json({ ok: true })
  } catch (error) {
    console.error('Error al actualizar empleado:', error)
    return res.status(500).json({ error: 'Error al actualizar empleado' })
  }
}

// ─── PATCH /empleados/mi-extranjero (empleado actualiza su propia nacionalidad) ─

export async function miNacionalidad(req: Request, res: Response) {
  try {
    const userId = req.user!.id
    const { esExtranjero } = req.body
    if (typeof esExtranjero !== 'boolean') {
      return res.status(400).json({ error: 'esExtranjero debe ser boolean' })
    }
    const registro = await prisma.registroIngreso.findUnique({ where: { userId } })
    if (!registro) return res.status(404).json({ error: 'Registro de empleado no encontrado' })
    const updated = await prisma.registroIngreso.update({
      where: { userId },
      data: { esExtranjero },
    })
    return res.json({ esExtranjero: updated.esExtranjero })
  } catch (error) {
    console.error('Error al actualizar nacionalidad:', error)
    return res.status(500).json({ error: 'Error al actualizar nacionalidad' })
  }
}

// ─── PATCH /empleados/:userId/extranjero (RH/ADMIN actualiza nacionalidad) ────

export async function actualizarNacionalidad(req: Request, res: Response) {
  try {
    const userId = Number(req.params['userId'])
    const { esExtranjero } = req.body
    if (typeof esExtranjero !== 'boolean') {
      return res.status(400).json({ error: 'esExtranjero debe ser boolean' })
    }
    const registro = await prisma.registroIngreso.findUnique({ where: { userId } })
    if (!registro) return res.status(404).json({ error: 'Registro de empleado no encontrado' })
    const updated = await prisma.registroIngreso.update({
      where: { userId },
      data: { esExtranjero },
    })
    await auditarAccion(req.user!.id, 'ACTUALIZAR_NACIONALIDAD', 'RegistroIngreso', registro.id, { userId, esExtranjero })
    return res.json({ esExtranjero: updated.esExtranjero })
  } catch (error) {
    console.error('Error al actualizar nacionalidad:', error)
    return res.status(500).json({ error: 'Error al actualizar nacionalidad' })
  }
}

// ─── Helpers para la lógica de baja ──────────────────────────────────────────

const TIPO_LABEL_BAJA: Record<string, string> = {
  ADMINISTRATIVO: 'Administrativo',
  GUARDIA: 'Guardia',
  LIMPIEZA_MANTENIMIENTO: 'Limpieza y Mantenimiento',
  DOCENTE: 'Docente',
}

/**
 * Lógica compartida: marca usuario inactivo, suspende GW y envía correo de baja.
 * Usada por darDeBaja (empleados) y eliminarUsuario (usuarios).
 */
export async function ejecutarBaja(userId: number, actorId: number, destinatariosExtra: string[] = []): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, nombre: true, correo: true, activo: true,
      registroIngreso: {
        select: { nombre: true, numColaborador: true, puesto: true, tipo: true },
      },
      cuenta: {
        select: {
          correoInstitucional: true,
          departamento: {
            select: { coordinador: { select: { correo: true } } },
          },
        },
      },
    },
  })

  if (!user) throw new Error('Usuario no encontrado')
  if (!user.activo) throw new Error('El usuario ya está inactivo')

  // 1. Marcar inactivo
  await prisma.user.update({ where: { id: userId }, data: { activo: false } })

  // 2. Suspender cuenta GW (best-effort)
  const correoGW = user.cuenta?.correoInstitucional
  if (correoGW) {
    try { await suspenderUsuarioWorkspace(correoGW) }
    catch (e) { console.error('GW suspend best-effort:', e) }
  }

  // 3. Enviar correo de baja (best-effort) — solo si tiene RegistroIngreso
  if (user.registroIngreso) {
    const { nombre, numColaborador, puesto, tipo } = user.registroIngreso
    const fechaBaja = new Date()
      .toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase()

    const htmlEmail = emailTemplates.bajaEmpleado(
      nombre.toUpperCase(),
      numColaborador,
      puesto.toUpperCase(),
      fechaBaja,
      TIPO_LABEL_BAJA[tipo] ?? tipo,
    )

    const destinatarios = [...new Set([
      'cortiz@mondragonmexico.edu.mx',
      ...destinatariosExtra,
    ])]

    try {
      for (const dest of destinatarios) {
        await sendEmail({
          to: dest,
          subject: `Baja de colaborador - ${nombre}`,
          html: htmlEmail,
        })
      }
    } catch (e) { console.error('Email baja best-effort:', e) }
  }

  await auditarAccion(actorId, 'BAJA_EMPLEADO', 'User', userId, {
    correo: user.correo,
    nombre: user.nombre,
  })
}

// ─── DELETE /empleados/:userId (dar de baja) ──────────────────────────────────

export async function darDeBaja(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const userId = parseInt(req.params.userId ?? '0')
    if (isNaN(userId) || userId <= 0) return res.status(400).json({ error: 'ID inválido' })

    const destinatariosExtra: string[] = Array.isArray(req.body?.destinatariosExtra)
      ? req.body.destinatariosExtra
      : []

    await ejecutarBaja(userId, actor.id, destinatariosExtra)
    return res.json({ mensaje: 'Empleado dado de baja correctamente' })
  } catch (error: any) {
    const msg = error?.message ?? 'Error al procesar la baja'
    if (msg === 'Usuario no encontrado') return res.status(404).json({ error: msg })
    if (msg === 'El usuario ya está inactivo') return res.status(400).json({ error: msg })
    console.error('Error al dar de baja:', error)
    return res.status(500).json({ error: msg })
  }
}

// ─── Helpers para importación masiva ─────────────────────────────────────────

function parseFecha(s: string): Date | null {
  if (!s) return null
  const limpio = s.trim().replace(/"/g, '')
  // DD/MM/YYYY
  const dmY = limpio.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmY && dmY[1] && dmY[2] && dmY[3]) {
    const d = new Date(`${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`)
    return isNaN(d.getTime()) ? null : d
  }
  // YYYY-MM-DD
  const iso = new Date(limpio)
  return isNaN(iso.getTime()) ? null : iso
}

function parseCSVRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

const normStr = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')

// ─── GET /empleados/plantilla-importar ───────────────────────────────────────

export function plantillaImportar(_req: Request, res: Response) {
  const encabezado = 'primerNombre,segundoNombre,primerApellido,segundoApellido,tipo,fechaNacimiento,numColaborador,fechaIngreso,puesto,departamento,correoInstitucional,contrasena'
  const ejemplo = 'Juan,Carlos,García,López,ADMINISTRATIVO,15/03/1990,001234,23/06/2026,Contador,TI,,miContrasena123'
  const csv = [encabezado, ejemplo].join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-empleados.csv"')
  return res.send('\uFEFF' + csv)
}

// ─── POST /empleados/importar ─────────────────────────────────────────────────
// Crea User+RegistroIngreso+CuentaInstitucional en bulk desde CSV.
// NO crea cuentas en Google Workspace (se hace individualmente después si se requiere).

export async function importarEmpleados(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload

    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const contenido = fs.readFileSync(req.file.path, 'utf-8').replace(/^\uFEFF/, '')
    fs.unlinkSync(req.file.path)

    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim())
    if (lineas.length < 2) {
      return res.status(400).json({ error: 'El archivo está vacío o solo tiene encabezados' })
    }

    const encabezado = parseCSVRow(lineas[0] ?? '').map((h) => h.toLowerCase().replace(/\s/g, ''))
    const col = (row: string[], nombre: string) => {
      const i = encabezado.indexOf(nombre)
      return i >= 0 ? (row[i] ?? '').trim() : ''
    }

    // Pre-cargar departamentos y rol
    const [departamentos, roleEmpleado] = await Promise.all([
      prisma.departamento.findMany({ select: { id: true, nombre: true } }),
      prisma.role.findUnique({ where: { nombre: 'EMPLEADO' } }),
    ])
    if (!roleEmpleado) return res.status(500).json({ error: 'Rol EMPLEADO no encontrado' })

    const deptMap = new Map(departamentos.map((d) => [d.nombre.toLowerCase().trim(), d.id]))
    const { env } = await import('../../config/env')
    const dominio = env.google.workspace.domain

    const errores: { linea: number; nombre: string; error: string }[] = []
    let creados = 0

    for (let i = 1; i < lineas.length; i++) {
      const lineaNum = i + 1
      const row = parseCSVRow(lineas[i] ?? '')

      const primerNombre  = col(row, 'primernombre')
      const segundoNombre = col(row, 'segundonombre')
      const primerApellido  = col(row, 'primerapellido')
      const segundoApellido = col(row, 'segundoapellido')
      const tipo = col(row, 'tipo').toUpperCase()
      const fechaNacStr = col(row, 'fechanacimiento')
      const numColaborador = col(row, 'numcolaborador')
      const fechaIngStr = col(row, 'fechaingreso')
      const puesto = col(row, 'puesto')
      const deptoNombre = col(row, 'departamento')
      let correoInstitucional = col(row, 'correoinstitucional')
      const contrasenaPlana = col(row, 'contrasena')

      const nombreCompleto = [primerNombre, segundoNombre, primerApellido, segundoApellido]
        .filter(Boolean).join(' ')
      const etiqueta = nombreCompleto || `Fila ${lineaNum}`

      // ── Validaciones ──────────────────────────────────────────
      if (!primerNombre || !primerApellido) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: 'primerNombre y primerApellido son requeridos' })
        continue
      }
      if (!TIPOS_COLABORADOR.includes(tipo as any)) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: `Tipo inválido: "${tipo}". Valores: ${TIPOS_COLABORADOR.join(', ')}` })
        continue
      }
      const fechaNacimiento = parseFecha(fechaNacStr)
      if (!fechaNacimiento) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: `Fecha de nacimiento inválida: "${fechaNacStr}". Use DD/MM/YYYY` })
        continue
      }
      const fechaIngreso = parseFecha(fechaIngStr)
      if (!fechaIngreso) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: `Fecha de ingreso inválida: "${fechaIngStr}". Use DD/MM/YYYY` })
        continue
      }
      if (!numColaborador) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: 'numColaborador es requerido' })
        continue
      }
      if (!puesto) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: 'puesto es requerido' })
        continue
      }

      const departamentoId = deptMap.get(deptoNombre.toLowerCase().trim())
      if (!departamentoId) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: `Departamento no encontrado: "${deptoNombre}"` })
        continue
      }

      // ── Auto-generar correo si no se proporcionó ──────────────
      if (!correoInstitucional) {
        const fn = normStr(primerNombre)
        const pa = normStr(primerApellido)
        const sa = segundoApellido ? normStr(segundoApellido) : ''
        const sn = segundoNombre ? normStr(segundoNombre) : ''

        const candidatos = tipo === 'DOCENTE'
          ? [`${fn}.${pa}@${dominio}`, sa ? `${fn}.${sa}@${dominio}` : '', sn ? `${fn[0]}${sn[0]}.${pa}@${dominio}` : '']
          : [`${fn[0]}${pa}@${dominio}`, sa ? `${fn[0]}${sa}@${dominio}` : '', sn ? `${sn[0]}${pa}@${dominio}` : '']

        for (const c of candidatos.filter(Boolean)) {
          const existe = await prisma.user.findUnique({ where: { correo: c }, select: { id: true } })
          if (!existe) { correoInstitucional = c; break }
        }

        if (!correoInstitucional) {
          errores.push({ linea: lineaNum, nombre: etiqueta, error: 'No se pudo generar correo único. Proporcione correoInstitucional manualmente.' })
          continue
        }
      } else {
        // Verificar correo proporcionado no exista ya
        const existe = await prisma.user.findUnique({ where: { correo: correoInstitucional }, select: { id: true } })
        if (existe) {
          errores.push({ linea: lineaNum, nombre: etiqueta, error: `El correo "${correoInstitucional}" ya está registrado` })
          continue
        }
      }

      // ── Crear User + RegistroIngreso + CuentaInstitucional ────
      try {
        const password = contrasenaPlana || generarPassword()
        const passwordHash = await bcrypt.hash(password, 10)

        const nuevoUserId = await prisma.$transaction(async (tx) => {
          const nuevoUser = await tx.user.create({
            data: {
              nombre: nombreCompleto,
              correo: correoInstitucional,
              password: passwordHash,
              activo: true,
              roles: { create: { roleId: roleEmpleado.id } },
            },
          })
          await tx.registroIngreso.create({
            data: {
              userId: nuevoUser.id,
              nombre: nombreCompleto,
              tipo: tipo as any,
              fechaNacimiento,
              numColaborador,
              fechaIngreso,
              puesto,
              archivoCredenciales: null,
              creadoPorId: actor.id,
            },
          })
          await tx.cuentaInstitucional.create({
            data: {
              userId: nuevoUser.id,
              correoInstitucional,
              departamentoId,
              creadoPorId: actor.id,
            },
          })
          return nuevoUser.id
        })

        // Generar PDF de credenciales (best-effort: si falla no deshace la creación)
        try {
          const archivoCredenciales = await generarArchivoCredenciales(
            nombreCompleto, correoInstitucional, password, nuevoUserId
          )
          await prisma.registroIngreso.update({
            where: { userId: nuevoUserId },
            data: { archivoCredenciales },
          })
        } catch (credErr) {
          console.error(`Error generando credenciales para ${correoInstitucional}:`, credErr)
        }

        creados++
      } catch (txErr: any) {
        errores.push({ linea: lineaNum, nombre: etiqueta, error: txErr?.message ?? 'Error al crear registro' })
      }
    }

    return res.json({
      creados,
      errores,
      total: lineas.length - 1,
      omitidos: errores.length,
    })
  } catch (error) {
    console.error('Error al importar empleados:', error)
    return res.status(500).json({ error: 'Error al procesar el archivo' })
  }
}

