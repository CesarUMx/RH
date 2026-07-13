import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { FaUpload, FaFilePdf, FaCheck, FaExclamationTriangle, FaClock, FaTimes, FaEye, FaChevronDown, FaChevronRight, FaDownload } from 'react-icons/fa'
import empleadosService from '../services/empleados.service'
import { MainLayout } from '../layouts/MainLayout'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'

import { expedientesService } from '../services/expedientes.service'
import type { ItemExpediente, EstadoDocumento, SeccionExpediente } from '../services/expedientes.service'

// ── Helper: agrupar por sección ───────────────────────────────────────────────

function agruparItemsPorSeccion(
  items: ItemExpediente[],
  secciones: SeccionExpediente[]
): { seccion: string; items: ItemExpediente[] }[] {
  const map = new Map<string, ItemExpediente[]>()
  for (const item of items) {
    const key = item.tipo.seccion?.trim() || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  // Ordenar items dentro de cada grupo por tipo.orden
  for (const [, arr] of map) arr.sort((a, b) => a.tipo.orden - b.tipo.orden)
  // Ordenar grupos por SeccionExpediente.orden, luego por nombre
  const ordenSeccion = (nombre: string) => {
    const s = secciones.find((x) => x.nombre === nombre)
    return s ? s.orden : 9999
  }
  const conNombre = [...map.entries()]
    .filter(([k]) => k !== '')
    .sort(([a], [b]) => ordenSeccion(a) - ordenSeccion(b) || a.localeCompare(b, 'es'))
    .map(([seccion, items]) => ({ seccion, items }))
  const sinSeccion = map.get('') ? [{ seccion: 'General', items: map.get('')! }] : []
  return [...conNombre, ...sinSeccion]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoDocumento, { label: string; color: string; icon: React.ReactNode }> = {
  PENDIENTE: {
    label: 'Pendiente de verificar',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <FaClock className="mr-1" />,
  },
  VERIFICADO: {
    label: 'Verificado',
    color: 'bg-green-100 text-green-800',
    icon: <FaCheck className="mr-1" />,
  },
  RECHAZADO: {
    label: 'Rechazado',
    color: 'bg-red-100 text-red-800',
    icon: <FaTimes className="mr-1" />,
  },
  PROXIMO_A_VENCER: {
    label: 'Próximo a vencer',
    color: 'bg-orange-100 text-orange-800',
    icon: <FaExclamationTriangle className="mr-1" />,
  },
  VENCIDO: {
    label: 'Vencido',
    color: 'bg-red-200 text-red-900',
    icon: <FaExclamationTriangle className="mr-1" />,
  },
}

const puedeEditar = (estado: EstadoDocumento | null) =>
  estado === null || ['PENDIENTE', 'RECHAZADO', 'PROXIMO_A_VENCER', 'VENCIDO'].includes(estado)

const formatFechaVigencia = (fecha: string | null, soloMesAnio: boolean) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  // Si es 31-dic → fue guardado como "solo año"
  if (d.getMonth() === 11 && d.getDate() === 31) {
    return d.getFullYear().toString()
  }
  if (soloMesAnio) {
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })
  }
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ── Componente ────────────────────────────────────────────────────────────────

export const MiExpediente = () => {
  const queryClient = useQueryClient()
  const [isSubirOpen, setIsSubirOpen] = useState(false)
  const [itemSeleccionado, setItemSeleccionado] = useState<ItemExpediente | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [fechaVigencia, setFechaVigencia] = useState('')
  const [archivoError, setArchivoError] = useState('')

  // ── Query ────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['mi-expediente'],
    queryFn: expedientesService.getMiExpediente,
  })

  const { data: secciones = [] } = useQuery({
    queryKey: ['secciones-expediente'],
    queryFn: expedientesService.getSecciones,
  })

  const { data: tieneCredenciales } = useQuery({
    queryKey: ['mis-credenciales-existe'],
    queryFn: empleadosService.tieneCredenciales,
  })

  const descargarCredMut = useMutation({
    mutationFn: empleadosService.descargarMisCredenciales,
    onError: () => toast.error('No se pudo descargar el archivo de credenciales'),
  })

  // ── Mutation ────────────────────────────────────────────────────────────────
  const computarFechaFinal = (): string | undefined => {
    if (!fechaVigencia) return undefined
    const precision = itemSeleccionado?.tipo.precisionVigencia?.toLowerCase()
    if (precision === 'anio') {
      const year = parseInt(fechaVigencia, 10)
      // último día del año
      return `${year}-12-31`
    }
    if (precision === 'mes') {
      // fechaVigencia es 'YYYY-MM'; calcular último día del mes
      const [y, m] = fechaVigencia.split('-').map(Number)
      const ultimo = new Date(y, m, 0).getDate()
      return `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
    }
    return fechaVigencia
  }

  const nacionalidadMut = useMutation({
    mutationFn: (esExtranjero: boolean) => empleadosService.actualizarMiNacionalidad(esExtranjero),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mi-expediente'] }),
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al actualizar'),
  })

  const subirMutation = useMutation({
    mutationFn: () =>
      expedientesService.subirDocumento(
        itemSeleccionado!.tipo.id,
        archivo!,
        computarFechaFinal()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-expediente'] })
      toast.success('Documento subido correctamente')
      cerrarModal()
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al subir documento'),
  })

  // ── Handlers ────────────────────────────────────────────────────────────────
  const abrirSubir = (item: ItemExpediente) => {
    setItemSeleccionado(item)
    setArchivo(null)
    setFechaVigencia('')
    setArchivoError('')
    setIsSubirOpen(true)
  }

  const cerrarModal = () => {
    setIsSubirOpen(false)
    setItemSeleccionado(null)
    setArchivo(null)
    setFechaVigencia('')
    setArchivoError('')
  }

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setArchivoError('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setArchivoError('Solo se permiten archivos PDF')
      return
    }
    setArchivo(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivo) { setArchivoError('Selecciona un archivo PDF'); return }
    if (itemSeleccionado?.tipo.requiereVigencia && !fechaVigencia) {
      toast.error('La fecha de vigencia es requerida para este documento')
      return
    }
    subirMutation.mutate()
  }

  // ── Grupos y estado inicial de acordeón ──────────────────────────────────────
  const grupos = useMemo(
    () => agruparItemsPorSeccion(data?.items ?? [], secciones),
    [data?.items, secciones]
  )

  // Secciones con algún doc no-verificado → abiertas por default; completas → cerradas
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  const isAbierto = (seccion: string, items: ItemExpediente[]) => {
    if (seccion in abiertos) return abiertos[seccion]
    // default: abierta si hay algún doc no verificado o sin documento
    return items.some((i) => !i.documento || i.documento.estado !== 'VERIFICADO')
  }

  const toggleSeccion = (seccion: string, items: ItemExpediente[]) =>
    setAbiertos((prev) => ({ ...prev, [seccion]: !isAbierto(seccion, items) }))

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Mi Expediente</h1>
          {tieneCredenciales && (
            <button
              onClick={() => descargarCredMut.mutate()}
              disabled={descargarCredMut.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              <FaDownload />
              {descargarCredMut.isPending ? 'Descargando...' : 'Descargar Credenciales'}
            </button>
          )}
        </div>

        {/* Nacionalidad */}
        {data && (
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span className="text-gray-600">Nacionalidad:</span>
            <button
              onClick={() => nacionalidadMut.mutate(!data.esExtranjero)}
              disabled={nacionalidadMut.isPending}
              className={`px-3 py-0.5 rounded-full text-xs font-medium transition-colors ${
                data.esExtranjero ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {data.esExtranjero ? 'Extranjero' : 'Mexicano'}
            </button>
            <span className="text-xs text-gray-400">Haz clic para cambiar y actualizar los documentos requeridos</span>
          </div>
        )}

        {/* Banner */}
        {data && (
          <div className={`rounded-lg p-4 flex items-center gap-3 mb-6 ${
            data.completo ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            {data.completo
              ? <FaCheck className="text-green-600 h-5 w-5 flex-shrink-0" />
              : <FaExclamationTriangle className="text-yellow-600 h-5 w-5 flex-shrink-0" />}
            <p className={`text-sm font-medium ${data.completo ? 'text-green-800' : 'text-yellow-800'}`}>
              {data.completo
                ? 'Tu expediente está completo y verificado. Ya puedes acceder a la sección de Contratos.'
                : 'Tu expediente aún no está completo. Sube y espera la verificación de todos los documentos requeridos.'}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {grupos.map(({ seccion, items: grupo }) => {
              const requeridos = grupo.filter((i) => i.tipo.requerido).length
              const verificadosReq = grupo.filter((i) => i.tipo.requerido && i.documento?.estado === 'VERIFICADO').length
              const rechazadosReq = grupo.filter((i) => i.tipo.requerido && i.documento?.estado === 'RECHAZADO').length
              const opcionales = grupo.filter((i) => !i.tipo.requerido).length
              const subidosOpc = grupo.filter((i) => !i.tipo.requerido && i.documento && i.documento.estado !== 'RECHAZADO').length

              const pct = requeridos > 0 ? Math.round((verificadosReq / requeridos) * 100) : 100
              const requeridosCompletos = requeridos === 0 || (verificadosReq === requeridos && rechazadosReq === 0)
              const opcionalesPendientes = requeridosCompletos && opcionales > 0 && subidosOpc < opcionales
              const seccionCompleta = requeridosCompletos && !opcionalesPendientes

              const badgeConfig = seccionCompleta
                ? { label: 'Completo', cls: 'bg-green-100 text-green-700' }
                : opcionalesPendientes
                  ? { label: 'Opc. pendientes', cls: 'bg-blue-100 text-blue-700' }
                  : { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' }

              const barColor = seccionCompleta ? 'bg-green-500' : opcionalesPendientes ? 'bg-blue-400' : 'bg-primary'

              const abierto = isAbierto(seccion, grupo)

              return (
                <div key={seccion} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Header acordeón */}
                  <button
                    type="button"
                    onClick={() => toggleSeccion(seccion, grupo)}
                    className="w-full flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-gray-400 flex-shrink-0">
                      {abierto ? <FaChevronDown className="h-3 w-3" /> : <FaChevronRight className="h-3 w-3" />}
                    </span>
                    <span className="font-semibold text-gray-700 uppercase tracking-wide text-sm flex-1 min-w-0">
                      {seccion}
                    </span>
                    {/* Barra de progreso — oculta en móvil muy pequeño */}
                    {requeridos > 0 && (
                      <div className="hidden xs:flex items-center gap-2">
                        <div className="w-16 sm:w-24 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{verificadosReq}/{requeridos}</span>
                      </div>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badgeConfig.cls}`}>
                      {badgeConfig.label}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{grupo.length} doc{grupo.length !== 1 ? 's' : ''}</span>
                  </button>

                  {/* Filas de documentos */}
                  {abierto && (
                    <div className="divide-y divide-gray-100 border-t border-gray-100">
                      {grupo.map((item) => {
                        const doc = item.documento
                        const estado = doc?.estado ?? null
                        const cfg = estado ? ESTADO_CONFIG[estado] : null
                        const editable = puedeEditar(estado)

                        return (
                          <div key={item.tipo.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50">
                            {/* Fila superior (móvil) / lado izquierdo (desktop): ícono + nombre + badges */}
                            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                              <FaFilePdf className="text-red-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-800">{item.tipo.nombre}</span>
                                  {item.tipo.requerido && (
                                    <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded leading-none">Req.</span>
                                  )}
                                </div>
                                {item.tipo.descripcion && (
                                  <p className="text-xs text-gray-500 mt-0.5">{item.tipo.descripcion}</p>
                                )}
                                {/* Detalles secundarios debajo del nombre */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                  {/* Estado badge */}
                                  {cfg ? (
                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                                      {cfg.icon}{cfg.label}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">Sin documento</span>
                                  )}
                                  {item.tipo.requiereVigencia && doc?.fechaVigencia && (
                                    <span className="text-xs text-gray-400">Vence: {formatFechaVigencia(doc.fechaVigencia, doc.soloMesAnio)}</span>
                                  )}
                                  {doc?.estado === 'RECHAZADO' && doc.motivoRechazo && (
                                    <span className="text-xs text-red-600" title={doc.motivoRechazo}>
                                      — {doc.motivoRechazo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Acciones */}
                            <div className="flex items-center gap-2 flex-shrink-0 pl-7 sm:pl-0">
                              {doc && (
                                <a
                                  href={expedientesService.getArchivoUrl(doc.archivo)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                                >
                                  <FaEye /> Ver
                                </a>
                              )}
                              {editable ? (
                                <Button size="sm" onClick={() => abrirSubir(item)}>
                                  <FaUpload className="mr-1" />
                                  {doc ? 'Reemplazar PDF' : 'Subir PDF'}
                                </Button>
                              ) : (
                                <span className="text-xs text-gray-300 text-center">Verificado</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal subir documento */}
      <Modal
        isOpen={isSubirOpen}
        onClose={cerrarModal}
        title={`Subir: ${itemSeleccionado?.tipo.nombre}`}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Zona de carga */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo PDF *
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                archivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary'
              }`}
              onClick={() => document.getElementById('pdf-input')?.click()}
            >
              <FaFilePdf className={`mx-auto h-8 w-8 mb-2 ${archivo ? 'text-green-500' : 'text-gray-400'}`} />
              {archivo ? (
                <p className="text-sm text-green-700 font-medium">{archivo.name}</p>
              ) : (
                <p className="text-sm text-gray-500">Haz clic para seleccionar un PDF (máx. 10MB)</p>
              )}
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleArchivoChange}
              />
            </div>
            {archivoError && <p className="mt-1 text-xs text-red-600">{archivoError}</p>}
          </div>

          {/* Vigencia (solo si el tipo la requiere) */}
          {itemSeleccionado?.tipo.requiereVigencia && (() => {
            const precision = itemSeleccionado.tipo.precisionVigencia ?? 'DIA'
            return (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Fecha de vigencia *
                  <span className="ml-1 text-xs text-gray-400">
                    ({precision === 'ANIO' ? 'Solo año' : precision === 'MES' ? 'Mes y año' : 'Fecha exacta'})
                  </span>
                </label>
                {precision === 'ANIO' && (
                  <input
                    type="number"
                    min={1900}
                    max={2099}
                    placeholder="Ej. 2028"
                    value={fechaVigencia}
                    onChange={(e) => setFechaVigencia(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                )}
                {precision === 'MES' && (
                  <input
                    type="month"
                    value={fechaVigencia}
                    onChange={(e) => setFechaVigencia(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                )}
                {precision === 'DIA' && (
                  <input
                    type="date"
                    value={fechaVigencia}
                    onChange={(e) => setFechaVigencia(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                )}
              </div>
            )
          })()}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" type="button" onClick={cerrarModal}>Cancelar</Button>
            <Button type="submit" isLoading={subirMutation.isPending}>
              <FaUpload className="mr-1" /> Subir
            </Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  )
}
