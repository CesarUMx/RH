import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { JwtPayload } from '../../middlewares/auth'
import { auditarAccion } from '../../utils/auditoria'
import { expedienteCompleto } from '../expedientes/controller'
import {
  generarCandidatosCorreo,
  verificarDisponibilidadCorreo,
  crearUsuarioWorkspace,
  suspenderUsuarioWorkspace,
  activarUsuarioWorkspace,
  generarPassword,
  PartesNombre,
  TipoEmpleado,
} from '../../services/googleWorkspace.service'

const prisma = new PrismaClient()

const sugerirSchema = z.object({
  primerNombre: z.string().min(1),
  segundoNombre: z.string().optional(),
  primerApellido: z.string().min(1),
  segundoApellido: z.string().optional(),
  tipo: z.enum(['DOCENTE', 'EMPLEADO']),
})

const crearCuentaSchema = z.object({
  userId: z.number().int().positive(),
  departamentoId: z.number().int().positive(),
  correoInstitucional: z.string().email(),
  primerNombre: z.string().min(1),
  primerApellido: z.string().min(1),
  tipo: z.enum(['DOCENTE', 'EMPLEADO']),
})

// ─── POST /cuentas/sugerir ────────────────────────────────────────────────────
// Devuelve los candidatos de correo disponibles en Google Workspace

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
    const candidatos = generarCandidatosCorreo(partes, tipo as TipoEmpleado)

    // Verificar disponibilidad de cada candidato en Google Workspace
    const resultados: { correo: string; disponible: boolean }[] = []
    for (const correo of candidatos) {
      try {
        const disponible = await verificarDisponibilidadCorreo(correo)
        resultados.push({ correo, disponible })
      } catch {
        // Si Google no está configurado, marcamos como desconocido
        resultados.push({ correo, disponible: true })
      }
    }

    return res.json({ candidatos: resultados })
  } catch (error) {
    console.error('Error al sugerir correo:', error)
    return res.status(500).json({ error: 'Error al generar sugerencias de correo' })
  }
}

// ─── POST /cuentas ────────────────────────────────────────────────────────────

export async function crearCuenta(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const validacion = crearCuentaSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: validacion.error.format() })
    }

    const { userId, departamentoId, correoInstitucional, primerNombre, primerApellido } = validacion.data

    // Verificar que el usuario exista
    const usuario = await prisma.user.findUnique({ where: { id: userId } })
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })

    // Verificar que no tenga ya una cuenta institucional
    const cuentaExistente = await prisma.cuentaInstitucional.findUnique({ where: { userId } })
    if (cuentaExistente) return res.status(400).json({ error: 'El usuario ya tiene una cuenta institucional' })

    // Verificar correo no duplicado en BD
    const correoDuplicado = await prisma.cuentaInstitucional.findUnique({ where: { correoInstitucional } })
    if (correoDuplicado) return res.status(400).json({ error: 'Ese correo institucional ya está en uso' })

    // Verificar que el expediente esté completo
    const expCompleto = await expedienteCompleto(userId)
    if (!expCompleto) {
      return res.status(400).json({ error: 'El empleado no tiene el expediente completo y verificado' })
    }

    // Verificar que tenga al menos un contrato
    const contrato = await prisma.contrato.findFirst({ where: { empleadoId: userId } })
    if (!contrato) {
      return res.status(400).json({ error: 'El empleado no tiene ningún contrato registrado' })
    }

    // Verificar que el departamento exista
    const departamento = await prisma.departamento.findUnique({ where: { id: departamentoId } })
    if (!departamento) return res.status(404).json({ error: 'Departamento no encontrado' })

    // Generar contraseña
    const password = generarPassword()

    // Crear cuenta en Google Workspace
    try {
      await crearUsuarioWorkspace(correoInstitucional, primerNombre, primerApellido, password)
    } catch (googleError: any) {
      console.error('Error al crear usuario en Google Workspace:', googleError)
      return res.status(502).json({
        error: 'No se pudo crear la cuenta en Google Workspace',
        detalle: googleError?.message ?? 'Error desconocido',
      })
    }

    // Guardar en base de datos
    const cuenta = await prisma.cuentaInstitucional.create({
      data: {
        userId,
        correoInstitucional,
        departamentoId,
        creadoPorId: actor.id,
      },
      include: {
        user: { select: { id: true, nombre: true, correo: true } },
        departamento: { select: { id: true, nombre: true } },
      },
    })

    await auditarAccion(actor.id, 'CREAR_CUENTA_INSTITUCIONAL', 'CuentaInstitucional', cuenta.id, {
      userId,
      correoInstitucional,
      departamentoId,
    })

    // Devolver cuenta + contraseña (única vez)
    return res.status(201).json({ cuenta, passwordTemporal: password })
  } catch (error) {
    console.error('Error al crear cuenta:', error)
    return res.status(500).json({ error: 'Error al crear cuenta institucional' })
  }
}

// ─── GET /cuentas ─────────────────────────────────────────────────────────────

export async function listarCuentas(req: Request, res: Response) {
  try {
    const { q, page = '1', pageSize = '15' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page))
    const size = Math.min(100, Math.max(1, parseInt(pageSize)))
    const skip = (pageNum - 1) * size

    const where = q
      ? {
          OR: [
            { correoInstitucional: { contains: q, mode: 'insensitive' as const } },
            { user: { nombre: { contains: q, mode: 'insensitive' as const } } },
            { departamento: { nombre: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}

    const [cuentas, total] = await Promise.all([
      prisma.cuentaInstitucional.findMany({
        where,
        skip,
        take: size,
        orderBy: { creadoEn: 'desc' },
        include: {
          user: { select: { id: true, nombre: true, correo: true } },
          departamento: { select: { id: true, nombre: true } },
          creadoPor: { select: { id: true, nombre: true } },
        },
      }),
      prisma.cuentaInstitucional.count({ where }),
    ])

    return res.json({ data: cuentas, pagination: { total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) } })
  } catch (error) {
    console.error('Error al listar cuentas:', error)
    return res.status(500).json({ error: 'Error al obtener cuentas institucionales' })
  }
}

// ─── GET /cuentas/:id ─────────────────────────────────────────────────────────

export async function obtenerCuenta(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const cuenta = await prisma.cuentaInstitucional.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nombre: true, correo: true } },
        departamento: true,
        creadoPor: { select: { id: true, nombre: true } },
      },
    })
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' })

    return res.json(cuenta)
  } catch (error) {
    console.error('Error al obtener cuenta:', error)
    return res.status(500).json({ error: 'Error al obtener cuenta institucional' })
  }
}

// ─── PATCH /cuentas/:id/suspender ────────────────────────────────────────────

export async function suspenderCuenta(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const cuenta = await prisma.cuentaInstitucional.findUnique({ where: { id } })
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' })
    if (cuenta.estado === 'SUSPENDIDA') return res.status(400).json({ error: 'La cuenta ya está suspendida' })

    await suspenderUsuarioWorkspace(cuenta.correoInstitucional)

    const actualizada = await prisma.cuentaInstitucional.update({
      where: { id },
      data: { estado: 'SUSPENDIDA' },
    })

    await auditarAccion(actor.id, 'SUSPENDER_CUENTA', 'CuentaInstitucional', id, { correo: cuenta.correoInstitucional })
    return res.json(actualizada)
  } catch (error: any) {
    console.error('Error al suspender cuenta:', error)
    return res.status(500).json({ error: error?.message ?? 'Error al suspender cuenta' })
  }
}

// ─── PATCH /cuentas/:id/activar ──────────────────────────────────────────────

export async function activarCuenta(req: Request, res: Response) {
  try {
    const actor = req.user as JwtPayload
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const cuenta = await prisma.cuentaInstitucional.findUnique({ where: { id } })
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' })
    if (cuenta.estado === 'ACTIVA') return res.status(400).json({ error: 'La cuenta ya está activa' })

    await activarUsuarioWorkspace(cuenta.correoInstitucional)

    const actualizada = await prisma.cuentaInstitucional.update({
      where: { id },
      data: { estado: 'ACTIVA' },
    })

    await auditarAccion(actor.id, 'ACTIVAR_CUENTA', 'CuentaInstitucional', id, { correo: cuenta.correoInstitucional })
    return res.json(actualizada)
  } catch (error: any) {
    console.error('Error al activar cuenta:', error)
    return res.status(500).json({ error: error?.message ?? 'Error al activar cuenta' })
  }
}
