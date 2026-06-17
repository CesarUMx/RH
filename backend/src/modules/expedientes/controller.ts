import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { auditarAccion } from '../../utils/auditoria'

const prisma = new PrismaClient()

// ─── Helper ────────────────────────────────────────────────────────────────────

export async function expedienteCompleto(empleadoId: number): Promise<boolean> {
  const tiposRequeridos = await prisma.tipoDocumentoExpediente.findMany({
    where: { requerido: true, activo: true },
  })
  if (tiposRequeridos.length === 0) return false

  for (const tipo of tiposRequeridos) {
    const doc = await prisma.documentoExpediente.findUnique({
      where: { empleadoId_tipoDocumentoId: { empleadoId, tipoDocumentoId: tipo.id } },
    })
    if (!doc || doc.estado !== 'VERIFICADO') return false
  }
  return true
}

// ─── ADMIN: Secciones ──────────────────────────────────────────────────────────

export async function listarSecciones(req: Request, res: Response) {
  try {
    const secciones = await prisma.seccionExpediente.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] })
    res.json(secciones)
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener secciones' })
  }
}

export async function crearSeccion(req: Request, res: Response) {
  try {
    const { nombre, orden } = req.body
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' })
    const seccion = await prisma.seccionExpediente.create({ data: { nombre: nombre.trim(), orden: orden ?? 0 } })
    res.status(201).json(seccion)
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe una sección con ese nombre' })
    res.status(500).json({ error: 'Error al crear sección' })
  }
}

export async function actualizarSeccion(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string)
    const { nombre, orden, activo } = req.body
    const seccion = await prisma.seccionExpediente.update({
      where: { id },
      data: { ...(nombre !== undefined && { nombre: nombre.trim() }), ...(orden !== undefined && { orden }), ...(activo !== undefined && { activo }) },
    })
    res.json(seccion)
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe una sección con ese nombre' })
    res.status(500).json({ error: 'Error al actualizar sección' })
  }
}

export async function eliminarSeccion(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string)
    await prisma.seccionExpediente.delete({ where: { id } })
    res.json({ message: 'Sección eliminada' })
  } catch (e: any) {
    res.status(500).json({ error: 'Error al eliminar sección' })
  }
}

// ─── ADMIN: Configuración de tipos de documento ────────────────────────────────

export async function listarTipos(req: Request, res: Response) {
  try {
    const tipos = await prisma.tipoDocumentoExpediente.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    })
    res.json(tipos)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener tipos de documento' })
  }
}

export async function crearTipo(req: Request, res: Response) {
  try {
    const { nombre, descripcion, seccion, requerido, requiereVigencia, orden } = req.body
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })

    const tipo = await prisma.tipoDocumentoExpediente.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        seccion: seccion?.trim() || null,
        requerido: requerido ?? false,
        requiereVigencia: requiereVigencia ?? false,
        orden: orden ?? 0,
      },
    })

    await auditarAccion(req.user!.id, 'CREAR', 'TipoDocumentoExpediente', tipo.id, tipo)
    res.status(201).json(tipo)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un tipo con ese nombre' })
    }
    console.error(error)
    res.status(500).json({ error: 'Error al crear tipo de documento' })
  }
}

export async function actualizarTipo(req: Request, res: Response) {
  try {
    const id = Number(req.params.id)
    const { nombre, descripcion, seccion, requerido, requiereVigencia, activo, orden } = req.body

    const tipo = await prisma.tipoDocumentoExpediente.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(descripcion !== undefined && { descripcion }),
        ...(seccion !== undefined && { seccion: seccion?.trim() || null }),
        ...(requerido !== undefined && { requerido }),
        ...(requiereVigencia !== undefined && { requiereVigencia }),
        ...(activo !== undefined && { activo }),
        ...(orden !== undefined && { orden }),
      },
    })

    await auditarAccion(req.user!.id, 'ACTUALIZAR', 'TipoDocumentoExpediente', tipo.id, tipo)
    res.json(tipo)
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tipo no encontrado' })
    if (error.code === 'P2002') return res.status(400).json({ error: 'Ya existe un tipo con ese nombre' })
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar tipo de documento' })
  }
}

export async function eliminarTipo(req: Request, res: Response) {
  try {
    const id = Number(req.params.id)
    const tieneDocumentos = await prisma.documentoExpediente.count({ where: { tipoDocumentoId: id } })
    if (tieneDocumentos > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: existen documentos asociados a este tipo' })
    }

    await prisma.tipoDocumentoExpediente.delete({ where: { id } })
    await auditarAccion(req.user!.id, 'ELIMINAR', 'TipoDocumentoExpediente', id, { id })
    res.json({ mensaje: 'Tipo eliminado correctamente' })
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tipo no encontrado' })
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar tipo de documento' })
  }
}

// ─── EMPLEADO: Mi expediente ──────────────────────────────────────────────────

export async function miExpediente(req: Request, res: Response) {
  try {
    const empleadoId = req.user!.id

    const tipos = await prisma.tipoDocumentoExpediente.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    })

    const documentos = await prisma.documentoExpediente.findMany({
      where: { empleadoId },
      include: { tipo: true },
    })

    const docMap = new Map(documentos.map((d) => [d.tipoDocumentoId, d]))

    const resultado = tipos.map((tipo) => ({
      tipo,
      documento: docMap.get(tipo.id) || null,
    }))

    const completo = await expedienteCompleto(empleadoId)

    res.json({ items: resultado, completo })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener el expediente' })
  }
}

export async function subirDocumento(req: Request, res: Response) {
  try {
    const empleadoId = req.user!.id
    const { tipoDocumentoId, fechaVigencia, soloMesAnio } = req.body
    const archivo = req.file

    if (!archivo) return res.status(400).json({ error: 'Archivo requerido' })
    if (!tipoDocumentoId) return res.status(400).json({ error: 'tipoDocumentoId requerido' })

    const tipoId = Number(tipoDocumentoId)
    const tipo = await prisma.tipoDocumentoExpediente.findUnique({ where: { id: tipoId } })
    if (!tipo || !tipo.activo) return res.status(404).json({ error: 'Tipo de documento no encontrado' })

    // Validar vigencia si el tipo la requiere
    let fechaVigenciaDate: Date | null = null
    const soloMesAnioFlag = soloMesAnio === 'true' || soloMesAnio === true

    if (tipo.requiereVigencia) {
      if (!fechaVigencia) return res.status(400).json({ error: 'La fecha de vigencia es requerida para este documento' })

      const parsed = new Date(fechaVigencia)
      if (isNaN(parsed.getTime())) return res.status(400).json({ error: 'Fecha de vigencia inválida' })

      // Si es solo mes/año, ajustar al último día del mes
      if (soloMesAnioFlag) {
        const year = parsed.getFullYear()
        const month = parsed.getMonth()
        fechaVigenciaDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
      } else {
        fechaVigenciaDate = parsed
      }
    }

    const rutaRelativa = `uploads/expedientes/${archivo.filename}`

    // Verificar si ya existe un documento para este tipo
    const docExistente = await prisma.documentoExpediente.findUnique({
      where: { empleadoId_tipoDocumentoId: { empleadoId, tipoDocumentoId: tipoId } },
    })

    if (docExistente) {
      // Bloquear si está VERIFICADO
      if (docExistente.estado === 'VERIFICADO') {
        // Eliminar el archivo recién subido
        fs.unlink(path.join(process.cwd(), archivo.path), () => {})
        return res.status(400).json({ error: 'No se puede reemplazar un documento verificado' })
      }

      // Rotar versión: archivo actual → anterior, borrar el anterior más viejo si existe
      if (docExistente.archivoAnterior) {
        const rutaAnteriorViejo = path.join(process.cwd(), docExistente.archivoAnterior)
        if (fs.existsSync(rutaAnteriorViejo)) {
          fs.unlink(rutaAnteriorViejo, () => {})
        }
      }

      const doc = await prisma.documentoExpediente.update({
        where: { id: docExistente.id },
        data: {
          archivo: rutaRelativa,
          nombreOriginal: archivo.originalname,
          estado: 'PENDIENTE',
          fechaVigencia: fechaVigenciaDate,
          soloMesAnio: soloMesAnioFlag,
          motivoRechazo: null,
          verificadoPorId: null,
          verificadoEn: null,
          alertaProximaEnviada: false,
          alertaVencidoEnviada: false,
          // guardar versión anterior
          archivoAnterior: docExistente.archivo,
          nombreOriginalAnterior: docExistente.nombreOriginal,
          fechaVigenciaAnterior: docExistente.fechaVigencia,
          reemplazadoEn: new Date(),
        },
      })

      await auditarAccion(empleadoId, 'REEMPLAZAR_DOCUMENTO', 'DocumentoExpediente', doc.id, { tipoId, nombreOriginal: archivo.originalname })
      return res.json(doc)
    }

    // Crear documento nuevo
    const doc = await prisma.documentoExpediente.create({
      data: {
        empleadoId,
        tipoDocumentoId: tipoId,
        archivo: rutaRelativa,
        nombreOriginal: archivo.originalname,
        estado: 'PENDIENTE',
        fechaVigencia: fechaVigenciaDate,
        soloMesAnio: soloMesAnioFlag,
      },
    })

    await auditarAccion(empleadoId, 'SUBIR_DOCUMENTO', 'DocumentoExpediente', doc.id, { tipoId, nombreOriginal: archivo.originalname })
    res.status(201).json(doc)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al subir documento' })
  }
}

// ─── RH / ADMIN: Validación de expedientes ────────────────────────────────────

export async function listarExpedientes(req: Request, res: Response) {
  try {
    // Obtener todos los usuarios con rol EMPLEADO
    const empleados = await prisma.user.findMany({
      where: {
        activo: true,
        roles: { some: { role: { nombre: 'EMPLEADO' } } },
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        documentosExpediente: {
          include: { tipo: true },
        },
      },
    })

    const tiposRequeridos = await prisma.tipoDocumentoExpediente.findMany({
      where: { requerido: true, activo: true },
    })

    const totalRequeridos = tiposRequeridos.length

    const resultado = empleados.map((emp) => {
      const verificados = emp.documentosExpediente.filter((d) => d.estado === 'VERIFICADO' && tiposRequeridos.some((t) => t.id === d.tipoDocumentoId)).length
      const completo = totalRequeridos > 0 && verificados === totalRequeridos
      return {
        id: emp.id,
        nombre: emp.nombre,
        correo: emp.correo,
        totalDocumentos: emp.documentosExpediente.length,
        verificados,
        totalRequeridos,
        completo,
      }
    })

    res.json(resultado)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al listar expedientes' })
  }
}

export async function obtenerExpedienteEmpleado(req: Request, res: Response) {
  try {
    const empleadoId = Number(req.params.empleadoId)

    const empleado = await prisma.user.findUnique({
      where: { id: empleadoId },
      select: { id: true, nombre: true, correo: true },
    })
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' })

    const tipos = await prisma.tipoDocumentoExpediente.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    })

    const documentos = await prisma.documentoExpediente.findMany({
      where: { empleadoId },
      include: { tipo: true },
    })

    const docMap = new Map(documentos.map((d) => [d.tipoDocumentoId, d]))

    const items = tipos.map((tipo) => ({
      tipo,
      documento: docMap.get(tipo.id) || null,
    }))

    const completo = await expedienteCompleto(empleadoId)
    res.json({ empleado, items, completo })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener expediente del empleado' })
  }
}

export async function verificarDocumento(req: Request, res: Response) {
  try {
    const docId = Number(req.params.id)
    const { accion, motivoRechazo } = req.body
    const rhId = req.user!.id

    if (!['VERIFICADO', 'RECHAZADO'].includes(accion)) {
      return res.status(400).json({ error: 'Acción inválida. Use VERIFICADO o RECHAZADO' })
    }
    if (accion === 'RECHAZADO' && !motivoRechazo) {
      return res.status(400).json({ error: 'El motivo de rechazo es requerido' })
    }

    const doc = await prisma.documentoExpediente.findUnique({
      where: { id: docId },
      include: { tipo: true, empleado: true },
    })
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' })

    const docActualizado = await prisma.documentoExpediente.update({
      where: { id: docId },
      data: {
        estado: accion as any,
        motivoRechazo: accion === 'RECHAZADO' ? motivoRechazo : null,
        verificadoPorId: accion === 'VERIFICADO' ? rhId : null,
        verificadoEn: accion === 'VERIFICADO' ? new Date() : null,
        alertaProximaEnviada: false,
        alertaVencidoEnviada: false,
      },
    })

    await auditarAccion(rhId, `DOC_${accion}`, 'DocumentoExpediente', docId, { accion, motivoRechazo })

    // Enviar email al empleado
    try {
      const { sendEmail, emailTemplates } = await import('../../services/email.service')
      if (accion === 'VERIFICADO') {
        await sendEmail({
          to: doc.empleado.correo,
          subject: 'Documento de expediente verificado',
          html: emailTemplates.documentoVerificado(doc.tipo.nombre),
        })
      } else {
        await sendEmail({
          to: doc.empleado.correo,
          subject: 'Documento de expediente rechazado',
          html: emailTemplates.documentoRechazado(doc.tipo.nombre, motivoRechazo),
        })
      }
    } catch (emailError) {
      console.error('[EMAIL] Error al enviar notificación:', emailError)
    }

    res.json(docActualizado)
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Documento no encontrado' })
    console.error(error)
    res.status(500).json({ error: 'Error al verificar documento' })
  }
}
