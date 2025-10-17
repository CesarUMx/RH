import { Request, Response } from 'express'
import { PrismaClient, EstadoPeriodo } from '@prisma/client'
import { z } from 'zod'
import { auditarAccion } from '../../utils/auditoria'

const prisma = new PrismaClient()

// Esquema de validación para crear un periodo
const createPeriodoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  fechaInicio: z.string().refine((value) => !isNaN(Date.parse(value)), {
    message: 'La fecha de inicio debe ser una fecha válida',
  }),
  fechaFin: z.string().refine((value) => !isNaN(Date.parse(value)), {
    message: 'La fecha de fin debe ser una fecha válida',
  }),
})

// Listar todos los periodos
export const listarPeriodos = async (req: Request, res: Response) => {
  try {
    // Si el usuario es coordinador, solo mostrar periodos abiertos
    const esCoordinador = req.user?.roles.some(role => role === 'COORD')
    
    let periodos
    if (esCoordinador) {
      periodos = await prisma.periodo.findMany({
        where: {
          estado: EstadoPeriodo.ABIERTO
        },
        orderBy: {
          fechaInicio: 'desc'
        }
      })
    } else {
      periodos = await prisma.periodo.findMany({
        orderBy: {
          fechaInicio: 'desc'
        }
      })
    }
    
    return res.json(periodos)
  } catch (error) {
    console.error('Error al listar periodos:', error)
    return res.status(500).json({ error: 'Error al listar periodos' })
  }
}

// Crear un nuevo periodo (siempre en estado BORRADOR)
export const crearPeriodo = async (req: Request, res: Response) => {
  try {
    const validacion = createPeriodoSchema.safeParse(req.body)
    
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }
    
    const { nombre, fechaInicio, fechaFin } = validacion.data
    
    // Validar que la fecha de inicio sea menor o igual a la fecha de fin
    const inicio = new Date(fechaInicio)
    const fin = new Date(fechaFin)
    
    if (inicio > fin) {
      return res.status(400).json({ 
        error: 'La fecha de inicio debe ser menor o igual a la fecha de fin' 
      })
    }
    
    // Crear el periodo en estado BORRADOR
    const nuevoPeriodo = await prisma.periodo.create({
      data: {
        nombre,
        fechaInicio: inicio,
        fechaFin: fin,
        estado: EstadoPeriodo.BORRADOR
      }
    })
    
    // Auditar la acción
    await auditarAccion(
      req.user?.id, 
      'CREAR', 
      'Periodo', 
      nuevoPeriodo.id, 
      nuevoPeriodo
    )
    
    return res.status(201).json(nuevoPeriodo)
  } catch (error: unknown) {
    console.error('Error al crear periodo:', error)
    
    // Verificar si es un error de clave única (nombre duplicado)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un periodo con ese nombre' })
    }
    
    return res.status(500).json({ error: 'Error al crear periodo' })
  }
}

// Cambiar estado a ABIERTO
export const abrirPeriodo = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    if (!id) {
      return res.status(400).json({ error: 'ID de periodo no proporcionado' })
    }
    const periodoId = parseInt(id)
    
    if (isNaN(periodoId)) {
      return res.status(400).json({ error: 'ID de periodo inválido' })
    }
    
    // Verificar si ya existe un periodo abierto
    const periodoAbierto = await prisma.periodo.findFirst({
      where: {
        estado: EstadoPeriodo.ABIERTO
      }
    })
    
    if (periodoAbierto && periodoAbierto.id !== periodoId) {
      return res.status(400).json({ 
        error: 'Ya existe un periodo abierto', 
        periodoAbierto 
      })
    }
    
    // Verificar que el periodo exista y esté en estado BORRADOR
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId }
    })
    
    if (!periodo) {
      return res.status(404).json({ error: 'Periodo no encontrado' })
    }
    
    if (periodo.estado !== EstadoPeriodo.BORRADOR) {
      return res.status(400).json({ 
        error: 'Solo se pueden abrir periodos en estado BORRADOR',
        estadoActual: periodo.estado
      })
    }
    
    // Actualizar el estado del periodo a ABIERTO
    const periodoActualizado = await prisma.periodo.update({
      where: { id: periodoId },
      data: { estado: EstadoPeriodo.ABIERTO }
    })
    
    // Auditar la acción
    await auditarAccion(
      req.user?.id, 
      'ABRIR', 
      'Periodo', 
      periodoId, 
      periodoActualizado
    )
    
    return res.json(periodoActualizado)
  } catch (error: unknown) {
    console.error('Error al abrir periodo:', error)
    return res.status(500).json({ error: 'Error al abrir periodo' })
  }
}

// Cambiar estado a CERRADO
export const cerrarPeriodo = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    if (!id) {
      return res.status(400).json({ error: 'ID de periodo no proporcionado' })
    }
    const periodoId = parseInt(id)
    
    if (isNaN(periodoId)) {
      return res.status(400).json({ error: 'ID de periodo inválido' })
    }
    
    // Verificar que el periodo exista y esté en estado ABIERTO
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId }
    })
    
    if (!periodo) {
      return res.status(404).json({ error: 'Periodo no encontrado' })
    }
    
    if (periodo.estado !== EstadoPeriodo.ABIERTO) {
      return res.status(400).json({ 
        error: 'Solo se pueden cerrar periodos en estado ABIERTO',
        estadoActual: periodo.estado
      })
    }
    
    // Actualizar el estado del periodo a CERRADO
    const periodoActualizado = await prisma.periodo.update({
      where: { id: periodoId },
      data: { estado: EstadoPeriodo.CERRADO }
    })
    
    // Auditar la acción
    await auditarAccion(
      req.user?.id, 
      'CERRAR', 
      'Periodo', 
      periodoId, 
      periodoActualizado
    )
    
    return res.json(periodoActualizado)
  } catch (error: unknown) {
    console.error('Error al cerrar periodo:', error)
    return res.status(500).json({ error: 'Error al cerrar periodo' })
  }
}

// Cambiar estado a REPORTADO
export const reportarPeriodo = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    if (!id) {
      return res.status(400).json({ error: 'ID de periodo no proporcionado' })
    }
    const periodoId = parseInt(id)
    
    if (isNaN(periodoId)) {
      return res.status(400).json({ error: 'ID de periodo inválido' })
    }
    
    // Verificar que el periodo exista y esté en estado CERRADO
    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId }
    })
    
    if (!periodo) {
      return res.status(404).json({ error: 'Periodo no encontrado' })
    }
    
    if (periodo.estado !== EstadoPeriodo.CERRADO) {
      return res.status(400).json({ 
        error: 'Solo se pueden reportar periodos en estado CERRADO',
        estadoActual: periodo.estado
      })
    }
    
    // Actualizar el estado del periodo a REPORTADO
    const periodoActualizado = await prisma.periodo.update({
      where: { id: periodoId },
      data: { estado: EstadoPeriodo.REPORTADO }
    })
    
    // Auditar la acción
    await auditarAccion(
      req.user?.id, 
      'REPORTAR', 
      'Periodo', 
      periodoId, 
      periodoActualizado
    )
    
    return res.json(periodoActualizado)
  } catch (error: unknown) {
    console.error('Error al reportar periodo:', error)
    return res.status(500).json({ error: 'Error al reportar periodo' })
  }
}
