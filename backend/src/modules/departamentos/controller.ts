import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { JwtPayload } from '../../middlewares/auth'
import { auditarAccion } from '../../utils/auditoria'

const prisma = new PrismaClient()

const departamentoSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().optional(),
  activo: z.boolean().optional().default(true),
})

const departamentoUpdateSchema = z.object({
  nombre: z.string().min(2).optional(),
  descripcion: z.string().optional(),
  activo: z.boolean().optional(),
})

// GET /departamentos
export async function listarDepartamentos(_req: Request, res: Response) {
  try {
    const departamentos = await prisma.departamento.findMany({
      orderBy: { nombre: 'asc' },
    })
    return res.json(departamentos)
  } catch (error) {
    console.error('Error al listar departamentos:', error)
    return res.status(500).json({ error: 'Error al obtener departamentos' })
  }
}

// POST /departamentos
export async function crearDepartamento(req: Request, res: Response) {
  try {
    const user = req.user as JwtPayload
    const validacion = departamentoSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: validacion.error.format() })
    }

    const { nombre, descripcion, activo } = validacion.data

    const existe = await prisma.departamento.findUnique({ where: { nombre } })
    if (existe) return res.status(400).json({ error: 'Ya existe un departamento con ese nombre' })

    const departamento = await prisma.departamento.create({
      data: { nombre, descripcion: descripcion ?? null, activo },
    })

    await auditarAccion(user.id, 'CREAR_DEPARTAMENTO', 'Departamento', departamento.id, { nombre })
    return res.status(201).json(departamento)
  } catch (error) {
    console.error('Error al crear departamento:', error)
    return res.status(500).json({ error: 'Error al crear departamento' })
  }
}

// PUT /departamentos/:id
export async function actualizarDepartamento(req: Request, res: Response) {
  try {
    const user = req.user as JwtPayload
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const validacion = departamentoUpdateSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: validacion.error.format() })
    }

    const existente = await prisma.departamento.findUnique({ where: { id } })
    if (!existente) return res.status(404).json({ error: 'Departamento no encontrado' })

    const { nombre, descripcion, activo } = validacion.data

    if (nombre && nombre !== existente.nombre) {
      const nombreOcupado = await prisma.departamento.findUnique({ where: { nombre } })
      if (nombreOcupado) return res.status(400).json({ error: 'Ya existe un departamento con ese nombre' })
    }

    const departamento = await prisma.departamento.update({
      where: { id },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion !== undefined && { descripcion }),
        ...(activo !== undefined && { activo }),
      },
    })

    await auditarAccion(user.id, 'ACTUALIZAR_DEPARTAMENTO', 'Departamento', id, { anterior: existente, nuevo: validacion.data })
    return res.json(departamento)
  } catch (error) {
    console.error('Error al actualizar departamento:', error)
    return res.status(500).json({ error: 'Error al actualizar departamento' })
  }
}

// DELETE /departamentos/:id
export async function eliminarDepartamento(req: Request, res: Response) {  try {
    const user = req.user as JwtPayload
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const existente = await prisma.departamento.findUnique({
      where: { id },
      include: { cuentas: { select: { id: true } } },
    })
    if (!existente) return res.status(404).json({ error: 'Departamento no encontrado' })

    if (existente.cuentas.length > 0) {
      await prisma.departamento.update({ where: { id }, data: { activo: false } })
      await auditarAccion(user.id, 'DESACTIVAR_DEPARTAMENTO', 'Departamento', id, { razon: 'tiene cuentas asociadas' })
      return res.json({ mensaje: 'Departamento marcado como inactivo porque tiene cuentas asociadas' })
    }

    await prisma.departamento.delete({ where: { id } })
    await auditarAccion(user.id, 'ELIMINAR_DEPARTAMENTO', 'Departamento', id, { nombre: existente.nombre })
    return res.json({ mensaje: 'Departamento eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar departamento:', error)
    return res.status(500).json({ error: 'Error al eliminar departamento' })
  }
}

// ─── Coordinador del departamento ─────────────────────────────────────────────

// PUT /departamentos/:id/coordinador
export async function asignarCoordinador(req: Request, res: Response) {
  try {
    const user = req.user as JwtPayload
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const { userId } = req.body
    if (!userId || typeof userId !== 'number') return res.status(400).json({ error: 'userId requerido' })

    const dep = await prisma.departamento.findUnique({ where: { id } })
    if (!dep) return res.status(404).json({ error: 'Departamento no encontrado' })

    const usr = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, nombre: true, correo: true } })
    if (!usr) return res.status(404).json({ error: 'Usuario no encontrado' })

    const actualizado = await prisma.departamento.update({
      where: { id },
      data: { coordinadorId: userId },
      include: { coordinador: { select: { id: true, nombre: true, correo: true } } },
    })

    await auditarAccion(user.id, 'ASIGNAR_COORDINADOR_DEPARTAMENTO', 'Departamento', id, { coordinadorId: userId })
    return res.json(actualizado)
  } catch (error) {
    console.error('Error al asignar coordinador:', error)
    return res.status(500).json({ error: 'Error al asignar coordinador' })
  }
}

// DELETE /departamentos/:id/coordinador
export async function quitarCoordinador(req: Request, res: Response) {
  try {
    const user = req.user as JwtPayload
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const actualizado = await prisma.departamento.update({
      where: { id },
      data: { coordinadorId: null },
    })

    await auditarAccion(user.id, 'QUITAR_COORDINADOR_DEPARTAMENTO', 'Departamento', id, {})
    return res.json(actualizado)
  } catch (error) {
    console.error('Error al quitar coordinador:', error)
    return res.status(500).json({ error: 'Error al quitar coordinador' })
  }
}

// GET /departamentos (ya existe, actualizar para incluir coordinador)
export async function listarDepartamentosConCoord(_req: Request, res: Response) {
  try {
    const departamentos = await prisma.departamento.findMany({
      orderBy: { nombre: 'asc' },
      include: { coordinador: { select: { id: true, nombre: true, correo: true } } },
    })
    return res.json(departamentos)
  } catch (error) {
    console.error('Error al listar departamentos:', error)
    return res.status(500).json({ error: 'Error al obtener departamentos' })
  }
}

// GET /departamentos/:id/miembros — usuarios con CuentaInstitucional en ese departamento
export async function getMiembros(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id ?? '0')
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' })

    const cuentas = await prisma.cuentaInstitucional.findMany({
      where: { departamentoId: id },
      select: {
        correoInstitucional: true,
        user: { select: { id: true, nombre: true } },
      },
    })

    return res.json(cuentas.map((c) => ({ id: c.user.id, nombre: c.user.nombre, correo: c.correoInstitucional })))
  } catch (error) {
    console.error('Error al obtener miembros:', error)
    return res.status(500).json({ error: 'Error al obtener miembros del departamento' })
  }
}
