import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { expedienteCompleto } from '../expedientes/controller'
import { auditarAccion } from '../../utils/auditoria'

const prisma = new PrismaClient()

// ─── RH / ADMIN: Subir contrato a un empleado ────────────────────────────────

export async function subirContrato(req: Request, res: Response) {
  try {
    const { empleadoId, titulo } = req.body
    const archivo = req.file
    const rhId = req.user!.id

    if (!archivo) return res.status(400).json({ error: 'Archivo requerido' })
    if (!empleadoId) return res.status(400).json({ error: 'empleadoId requerido' })
    if (!titulo) return res.status(400).json({ error: 'El título es requerido' })

    const empId = Number(empleadoId)
    const empleado = await prisma.user.findUnique({ where: { id: empId } })
    if (!empleado) {
      fs.unlink(path.join(process.cwd(), archivo.path), () => {})
      return res.status(404).json({ error: 'Empleado no encontrado' })
    }

    // Verificar que el expediente esté completo antes de subir contrato
    const completo = await expedienteCompleto(empId)
    if (!completo) {
      fs.unlink(path.join(process.cwd(), archivo.path), () => {})
      return res.status(400).json({ error: 'El empleado no tiene el expediente completo y verificado' })
    }

    const rutaRelativa = `uploads/contratos/${archivo.filename}`

    const contrato = await prisma.contrato.create({
      data: {
        empleadoId: empId,
        titulo,
        archivo: rutaRelativa,
        nombreOriginal: archivo.originalname,
        subidoPorId: rhId,
      },
    })

    await auditarAccion(rhId, 'SUBIR_CONTRATO', 'Contrato', contrato.id, { empleadoId: empId, titulo })
    res.status(201).json(contrato)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al subir contrato' })
  }
}

export async function listarContratos(req: Request, res: Response) {
  try {
    const { empleadoId } = req.query

    const contratos = await prisma.contrato.findMany({
      where: empleadoId ? { empleadoId: Number(empleadoId) } : {},
      include: {
        empleado: { select: { id: true, nombre: true, correo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(contratos)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al listar contratos' })
  }
}

export async function eliminarContrato(req: Request, res: Response) {
  try {
    const id = Number(req.params.id)
    const contrato = await prisma.contrato.findUnique({ where: { id } })
    if (!contrato) return res.status(404).json({ error: 'Contrato no encontrado' })

    // Eliminar archivo del disco
    const rutaArchivo = path.join(process.cwd(), contrato.archivo)
    if (fs.existsSync(rutaArchivo)) fs.unlink(rutaArchivo, () => {})

    await prisma.contrato.delete({ where: { id } })
    await auditarAccion(req.user!.id, 'ELIMINAR_CONTRATO', 'Contrato', id, { id })
    res.json({ mensaje: 'Contrato eliminado correctamente' })
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Contrato no encontrado' })
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar contrato' })
  }
}

// ─── EMPLEADO: Mis contratos ─────────────────────────────────────────────────

export async function misContratos(req: Request, res: Response) {
  try {
    const empleadoId = req.user!.id

    // Verificar expediente completo para poder acceder
    const completo = await expedienteCompleto(empleadoId)
    if (!completo) {
      return res.status(403).json({
        error: 'Tu expediente no está completo. Completa y espera la verificación de todos los documentos requeridos.',
        expedienteIncompleto: true,
      })
    }

    const contratos = await prisma.contrato.findMany({
      where: { empleadoId },
      orderBy: { createdAt: 'desc' },
    })

    res.json(contratos)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener contratos' })
  }
}

export async function descargarContrato(req: Request, res: Response) {
  try {
    const id = Number(req.params.id)
    const empleadoId = req.user!.id

    const contrato = await prisma.contrato.findUnique({ where: { id } })
    if (!contrato) return res.status(404).json({ error: 'Contrato no encontrado' })

    // Solo el dueño puede descargar su contrato
    if (contrato.empleadoId !== empleadoId) {
      return res.status(403).json({ error: 'No autorizado para descargar este contrato' })
    }

    const rutaArchivo = path.join(process.cwd(), contrato.archivo)
    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' })
    }

    res.download(rutaArchivo, contrato.nombreOriginal)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al descargar contrato' })
  }
}
