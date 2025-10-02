import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'


const prisma = new PrismaClient()

async function main() {
  // Roles base
  const roles = ['ADMIN', 'RH', 'COORD']
  for (const nombre of roles) {
    await prisma.role.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    })
  }

  // Admin por defecto
  const correoAdmin = 'admin@local.test'
  const passPlano = 'admin123'
  const hash = await bcrypt.hash(passPlano, 10)

  await prisma.user.upsert({
    where: { correo: correoAdmin },
    update: {},
    create: {
      nombre: 'Admin',
      correo: correoAdmin,
      password: hash,
      activo: true,
      roles: {
        create: [{ role: { connect: { nombre: 'ADMIN' } } }]
      }
    }
  })

  // Áreas demo
  await prisma.area.upsert({
    where: { nombre: 'Preparatoria' },
    update: {},
    create: { nombre: 'Preparatoria', activo: true }
  })

  await prisma.area.upsert({
    where: { nombre: 'Licenciaturas' },
    update: {},
    create: { nombre: 'Licenciaturas', activo: true }
  })

  console.log('✅ Seed ejecutado con éxito')
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
