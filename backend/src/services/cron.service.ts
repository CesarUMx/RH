import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Servicio de tareas programadas (Cron Jobs)
 * Zona horaria: America/Mexico_City (UTC-6)
 */

/**
 * Cierra automáticamente los períodos que han pasado su fecha de fin
 * 
 * Lógica:
 * - Si un período está en estado ABIERTO
 * - Y la fecha actual es DESPUÉS de la fecha de fin (fechaFin < hoy)
 * - Entonces se cierra automáticamente
 * 
 * Ejemplo: Si el período cierra el 20, durante el día 20 permanece abierto.
 *          El día 21 a medianoche (00:00) se cerrará automáticamente.
 */
async function cerrarPeriodosVencidos() {
  try {
    const ahora = new Date()
    
    // Buscar TODOS los períodos ABIERTOS para ver sus fechas
    const todosLosAbiertos = await prisma.periodo.findMany({
      where: {
        estado: 'ABIERTO'
      }
    })
    
    // Mostrar información de cada período abierto
    todosLosAbiertos.forEach((periodo, index) => {
      console.log(`\n   Período ${index + 1}: "${periodo.nombre}" (ID: ${periodo.id})`)
      console.log(`   - Fecha inicio: ${periodo.fechaInicio.toISOString()} (${periodo.fechaInicio.toLocaleDateString('es-MX')})`)
      console.log(`   - Fecha fin: ${periodo.fechaFin.toISOString()} (${periodo.fechaFin.toLocaleDateString('es-MX')})`)
      console.log(`   - ¿Fecha fin < ahora?: ${periodo.fechaFin < ahora} (${periodo.fechaFin.getTime()} < ${ahora.getTime()})`)
      console.log(`   - Diferencia en días: ${Math.floor((ahora.getTime() - periodo.fechaFin.getTime()) / (1000 * 60 * 60 * 24))} días`)
    })
    
    // Buscar períodos ABIERTOS cuya fecha de fin ya pasó
    const periodosVencidos = await prisma.periodo.findMany({
      where: {
        estado: 'ABIERTO',
        fechaFin: {
          lt: ahora // fechaFin < ahora (menor que ahora)
        }
      }
    })
    
    if (periodosVencidos.length === 0) {
      console.log('[CRON] No hay períodos para cerrar')
      return
    }
    
    console.log(`[CRON] Se encontraron ${periodosVencidos.length} período(s) vencido(s)`)
    
    // Cerrar cada período vencido
    for (const periodo of periodosVencidos) {
      await prisma.periodo.update({
        where: { id: periodo.id },
        data: { estado: 'CERRADO' }
      })
      
      console.log(`[CRON] Período cerrado: "${periodo.nombre}" (ID: ${periodo.id})`)
      console.log(`   - Fecha de fin: ${periodo.fechaFin.toLocaleDateString('es-MX')}`)
      console.log(`   - Estado: ABIERTO → CERRADO`)
    }
    
    console.log(`[CRON] Se cerraron ${periodosVencidos.length} período(s) correctamente`)
    
  } catch (error) {
    console.error('[CRON] Error al cerrar períodos vencidos:', error)
  }
}

/**
 * Revisa la vigencia de todos los documentos de expediente.
 * - Estado VERIFICADO y a 7 días o menos de vencer → PROXIMO_A_VENCER + email
 * - Estado PROXIMO_A_VENCER o VERIFICADO y ya venció → VENCIDO + email
 * Usa flags alertaProximaEnviada / alertaVencidoEnviada para no reenviar.
 */
async function revisarVigenciaDocumentos() {
  try {
    console.log('[CRON] Iniciando revisión de vigencia de documentos...')

    const ahora = new Date()
    const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Buscar documentos que tengan vigencia definida y estado relevante
    const documentos = await prisma.documentoExpediente.findMany({
      where: {
        fechaVigencia: { not: null },
        estado: { in: ['VERIFICADO', 'PROXIMO_A_VENCER'] },
      },
      include: {
        tipo: true,
        empleado: { select: { correo: true, nombre: true } },
      },
    })

    let vencidos = 0
    let proximosAVencer = 0

    const { sendEmail, emailTemplates } = await import('./email.service')

    for (const doc of documentos) {
      if (!doc.fechaVigencia) continue

      const yaVencio = doc.fechaVigencia < ahora
      const proximoAVencer = !yaVencio && doc.fechaVigencia <= en7Dias

      if (yaVencio && doc.estado !== 'VENCIDO') {
        await prisma.documentoExpediente.update({
          where: { id: doc.id },
          data: { estado: 'VENCIDO', alertaVencidoEnviada: true },
        })
        vencidos++

        if (!doc.alertaVencidoEnviada) {
          try {
            await sendEmail({
              to: doc.empleado.correo,
              subject: `Documento vencido: ${doc.tipo.nombre}`,
              html: emailTemplates.documentoVencido(doc.tipo.nombre),
            })
          } catch (e) {
            console.error(`[CRON] Error enviando email vencido a ${doc.empleado.correo}:`, e)
          }
        }
      } else if (proximoAVencer && doc.estado === 'VERIFICADO') {
        await prisma.documentoExpediente.update({
          where: { id: doc.id },
          data: { estado: 'PROXIMO_A_VENCER', alertaProximaEnviada: true },
        })
        proximosAVencer++

        if (!doc.alertaProximaEnviada) {
          try {
            const fechaFormateada = doc.fechaVigencia.toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
            await sendEmail({
              to: doc.empleado.correo,
              subject: `Documento próximo a vencer: ${doc.tipo.nombre}`,
              html: emailTemplates.documentoProximoVencer(doc.tipo.nombre, fechaFormateada),
            })
          } catch (e) {
            console.error(`[CRON] Error enviando email próximo a vencer a ${doc.empleado.correo}:`, e)
          }
        }
      }
    }

    console.log(`[CRON] Vigencia revisada: ${vencidos} vencido(s), ${proximosAVencer} próximo(s) a vencer`)
  } catch (error) {
    console.error('[CRON] Error al revisar vigencia de documentos:', error)
  }
}

/**
 * Inicializa todas las tareas programadas
 */
export function inicializarCronJobs() {
  console.log('Inicializando tareas programadas (Cron Jobs)...')

  // Cierre automático de períodos vencidos - 00:00 diario
  cron.schedule('0 0 * * *', () => {
    cerrarPeriodosVencidos()
  }, {
    timezone: 'America/Mexico_City'
  })

  // Verificación de vigencia de documentos de expediente - 00:00 diario
  cron.schedule('0 0 * * *', () => {
    revisarVigenciaDocumentos()
  }, {
    timezone: 'America/Mexico_City'
  })
}
