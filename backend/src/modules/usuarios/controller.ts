import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const prisma = new PrismaClient()

// Esquemas de validación
const usuarioSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  correo: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  roles: z.array(z.string()).min(1, 'Debe asignar al menos un rol'),
  activo: z.boolean().optional().default(true)
})

const usuarioUpdateSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').optional(),
  roles: z.array(z.string()).min(1, 'Debe asignar al menos un rol').optional(),
  activo: z.boolean().optional()
})

// GET /usuarios - Listar todos los usuarios con sus roles
export async function listarUsuarios(_req: Request, res: Response) {
  try {
    const usuarios = await prisma.user.findMany({
      select: {
        id: true,
        nombre: true,
        correo: true,
        activo: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                nombre: true
              }
            }
          }
        }
      }
    })

    // Transformar la respuesta para simplificar la estructura
    const usuariosFormateados = usuarios.map(u => ({
      id: u.id,
      nombre: u.nombre,
      correo: u.correo,
      activo: u.activo,
      createdAt: u.createdAt,
      roles: u.roles.map(r => r.role.nombre)
    }))

    return res.json(usuariosFormateados)
  } catch (error) {
    console.error('Error al listar usuarios:', error)
    return res.status(500).json({ error: 'Error al obtener usuarios' })
  }
}

// POST /usuarios - Crear un nuevo usuario con roles
export async function crearUsuario(req: Request, res: Response) {
  try {
    // Validar datos de entrada
    const validacion = usuarioSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { nombre, correo, password, roles, activo } = validacion.data

    // Verificar que el correo no exista
    const usuarioExistente = await prisma.user.findUnique({
      where: { correo }
    })

    if (usuarioExistente) {
      return res.status(400).json({ error: 'El correo ya está registrado' })
    }

    // Verificar que los roles existan
    const rolesExistentes = await prisma.role.findMany({
      where: { nombre: { in: roles } }
    })

    if (rolesExistentes.length !== roles.length) {
      return res.status(400).json({ error: 'Uno o más roles no existen' })
    }

    // Hashear la contraseña
    const hash = await bcrypt.hash(password, 10)

    // Crear el usuario con sus roles
    const usuario = await prisma.user.create({
      data: {
        nombre,
        correo,
        password: hash,
        activo,
        roles: {
          create: roles.map(rolNombre => ({
            role: {
              connect: { nombre: rolNombre }
            }
          }))
        }
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        activo: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                nombre: true
              }
            }
          }
        }
      }
    })

    // Transformar la respuesta
    const usuarioCreado = {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      activo: usuario.activo,
      createdAt: usuario.createdAt,
      roles: usuario.roles.map(r => r.role.nombre)
    }

    return res.status(201).json(usuarioCreado)
  } catch (error) {
    console.error('Error al crear usuario:', error)
    return res.status(500).json({ error: 'Error al crear usuario' })
  }
}

// PUT /usuarios/:id - Actualizar un usuario existente
export async function actualizarUsuario(req: Request, res: Response) {
  try {
    const { id } = req.params
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de usuario requerido' })
    }
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' })
    }

    // Validar datos de entrada
    const validacion = usuarioUpdateSchema.safeParse(req.body)
    if (!validacion.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        detalles: validacion.error.format() 
      })
    }

    const { nombre, roles, activo } = validacion.data

    // Verificar que el usuario exista
    const usuarioExistente = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    })

    if (!usuarioExistente) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // Datos para actualizar
    const updateData: any = {}
    if (nombre !== undefined) updateData.nombre = nombre
    if (activo !== undefined) updateData.activo = activo

    // Actualizar el usuario
    let usuario = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { roles: { include: { role: true } } }
    })

    // Actualizar roles si se proporcionaron
    if (roles && roles.length > 0) {
      // Verificar que los roles existan
      const rolesExistentes = await prisma.role.findMany({
        where: { nombre: { in: roles } }
      })

      if (rolesExistentes.length !== roles.length) {
        return res.status(400).json({ error: 'Uno o más roles no existen' })
      }

      // Eliminar roles actuales
      await prisma.userRole.deleteMany({
        where: { userId }
      })

      // Asignar nuevos roles
      await Promise.all(
        roles.map(rolNombre =>
          prisma.userRole.create({
            data: {
              user: { connect: { id: userId } },
              role: { connect: { nombre: rolNombre } }
            }
          })
        )
      )

      // Obtener el usuario actualizado con sus nuevos roles
      usuario = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } }
      }) as typeof usuario
    }

    // Transformar la respuesta
    const usuarioActualizado = {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      activo: usuario.activo,
      createdAt: usuario.createdAt,
      roles: usuario.roles.map(r => r.role.nombre)
    }

    return res.json(usuarioActualizado)
  } catch (error) {
    console.error('Error al actualizar usuario:', error)
    return res.status(500).json({ error: 'Error al actualizar usuario' })
  }
}

// DELETE /usuarios/:id - Eliminar un usuario (soft delete)
export async function eliminarUsuario(req: Request, res: Response) {
  try {
    const { id } = req.params
    // Aseguramos que id no sea undefined antes de usar parseInt
    if (!id) {
      return res.status(400).json({ error: 'ID de usuario requerido' })
    }
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' })
    }

    // Verificar que el usuario exista
    const usuarioExistente = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    })

    if (!usuarioExistente) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // Verificar que el usuario no se esté eliminando a sí mismo
    if (req.user && req.user.id === userId) {
      // Verificar si es el único administrador
      const esAdmin = usuarioExistente.roles.some(r => r.role.nombre === 'ADMIN')
      
      if (esAdmin) {
        // Contar cuántos administradores hay
        const adminCount = await prisma.userRole.count({
          where: {
            role: { nombre: 'ADMIN' }
          }
        })

        if (adminCount <= 1) {
          return res.status(403).json({ 
            error: 'No puedes eliminarte a ti mismo si eres el único administrador' 
          })
        }
      }
    }

    // Realizar soft delete (marcar como inactivo)
    await prisma.user.update({
      where: { id: userId },
      data: { activo: false }
    })

    return res.json({ mensaje: 'Usuario eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar usuario:', error)
    return res.status(500).json({ error: 'Error al eliminar usuario' })
  }
}

// GET /roles - Listar todos los roles disponibles
export async function listarRoles(_req: Request, res: Response) {
  try {
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        nombre: true
      }
    })

    return res.json(roles)
  } catch (error) {
    console.error('Error al listar roles:', error)
    return res.status(500).json({ error: 'Error al obtener roles' })
  }
}
