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
 * Inicializa todas las tareas programadas
 */
export function inicializarCronJobs() {
  console.log('Inicializando tareas programadas (Cron Jobs)...')
  
  // ============================================
  // PRUEBA: Ejecutar a las 3:00 PM hora México
  // ============================================
  // Cron expression: '0 15 * * *'
  // - *: todos los días del mes
  // - *: todos los meses
  // - *: todos los días de la semana
  
  // cron.schedule('30 14 * * *', () => {
  //   cerrarPeriodosVencidos()
  // }, {
  //   timezone: 'America/Mexico_City'
  // })
  
  // ============================================
  // PRODUCCIÓN: Ejecutar a medianoche (00:00)
  // ============================================
  // Descomentar la siguiente línea para producción y comentar la de arriba
  
  // cron.schedule('0 0 * * *', () => {
  //   cerrarPeriodosVencidos()
  // }, {
  //   timezone: 'America/Mexico_City'
  // })
  
  // console.log('Cron configurado: Verificación de cierre de períodos a las 00:00 (medianoche, hora México)')
}
