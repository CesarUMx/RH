import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { FaCheck, FaEye, FaUser, FaChevronLeft, FaFilePdf, FaTrash, FaUndo } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'

import { MainLayout } from '../layouts/MainLayout'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'

import { expedientesService } from '../services/expedientes.service'
import type { EmpleadoExpediente, ItemExpediente, EstadoDocumento, SeccionExpediente } from '../services/expedientes.service'

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
  for (const [, arr] of map) arr.sort((a, b) => a.tipo.orden - b.tipo.orden)
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

const ESTADO_CONFIG: Record<EstadoDocumento, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  VERIFICADO: { label: 'Verificado', color: 'bg-green-100 text-green-800' },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
  PROXIMO_A_VENCER: { label: 'Próximo a vencer', color: 'bg-orange-100 text-orange-800' },
  VENCIDO: { label: 'Vencido', color: 'bg-red-200 text-red-900' },
}

const formatFecha = (fecha: string | null) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Componente: Tarjeta empleado ──────────────────────────────────────────────

const TarjetaEmpleado = ({
  emp,
  onClick,
}: {
  emp: EmpleadoExpediente
  onClick: () => void
}) => {
  const pct = emp.totalRequeridos > 0 ? Math.round((emp.verificados / emp.totalRequeridos) * 100) : 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg shadow border border-gray-100 p-4 hover:border-primary hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <FaUser className="text-gray-400" />
          <div>
            <p className="font-semibold text-gray-900">{emp.nombre}</p>
            <p className="text-xs text-gray-500">{emp.correo}</p>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            emp.completo ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {emp.completo ? 'Completo' : 'Incompleto'}
        </span>
      </div>
      {/* Barra de progreso */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{emp.verificados} de {emp.totalRequeridos} requeridos verificados</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${emp.completo ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export const ValidarExpedientes = () => {
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const isAdmin = hasRole('ADMIN')
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [isVerificarOpen, setIsVerificarOpen] = useState(false)
  const [docSeleccionado, setDocSeleccionado] = useState<{ id: number; nombre: string } | null>(null)
  const [accionDoc, setAccionDoc] = useState<'VERIFICADO' | 'RECHAZADO' | 'REVERTIR'>('VERIFICADO')
  const [motivoRechazo, setMotivoRechazo] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: empleados = [], isLoading: loadingLista } = useQuery({
    queryKey: ['expedientes-lista'],
    queryFn: expedientesService.listarExpedientes,
  })

  const { data: secciones = [] } = useQuery({
    queryKey: ['secciones-expediente'],
    queryFn: expedientesService.getSecciones,
  })

  const { data: detalle, isLoading: loadingDetalle } = useQuery({
    queryKey: ['expediente-empleado', empleadoSeleccionado],
    queryFn: () => expedientesService.getExpedienteEmpleado(empleadoSeleccionado!),
    enabled: empleadoSeleccionado !== null,
  })

  // ── Mutation ────────────────────────────────────────────────────────────────
  const verificarMutation = useMutation({
    mutationFn: () =>
      accionDoc === 'REVERTIR'
        ? expedientesService.revertirDocumento(docSeleccionado!.id)
        : expedientesService.verificarDocumento(docSeleccionado!.id, accionDoc, motivoRechazo || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedientes-lista'] })
      queryClient.invalidateQueries({ queryKey: ['expediente-empleado', empleadoSeleccionado] })
      toast.success(
        accionDoc === 'VERIFICADO' ? 'Documento verificado' :
        accionDoc === 'REVERTIR'   ? 'Documento revertido a Rechazado' :
        'Documento rechazado'
      )
      cerrarModalVerificar()
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al procesar'),
  })

  // ── Handlers ────────────────────────────────────────────────────────────────
  const abrirVerificar = (item: ItemExpediente, tipo: 'VERIFICADO' | 'RECHAZADO' | 'REVERTIR') => {
    if (!item.documento) return
    setDocSeleccionado({ id: item.documento.id, nombre: item.tipo.nombre })
    setAccionDoc(tipo)
    setMotivoRechazo('')
    setIsVerificarOpen(true)
  }

  const cerrarModalVerificar = () => {
    setIsVerificarOpen(false)
    setDocSeleccionado(null)
    setMotivoRechazo('')
  }

  const empleadosFiltrados = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.correo.toLowerCase().includes(busqueda.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            {empleadoSeleccionado && (
              <button
                onClick={() => setEmpleadoSeleccionado(null)}
                className="mr-3 text-primary hover:text-primary-dark transition-colors"
              >
                <FaChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-800">
              {empleadoSeleccionado && detalle ? `Expediente: ${detalle.empleado.nombre}` : 'Validar Expedientes'}
            </h1>
          </div>
        </div>

        {/* Vista: lista de empleados */}
        {!empleadoSeleccionado && (
          <>
            <div className="max-w-sm">
              <Input
                placeholder="Buscar por nombre o correo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {loadingLista ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : empleadosFiltrados.length === 0 ? (
              <p className="text-center text-gray-500 py-10">No hay empleados registrados</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
                {empleadosFiltrados.map((emp) => (
                  <TarjetaEmpleado key={emp.id} emp={emp} onClick={() => setEmpleadoSeleccionado(emp.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Vista: detalle del expediente */}
        {empleadoSeleccionado && (
          <>
            {loadingDetalle ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {/* Banner estado expediente */}
                {detalle && (
                  <div
                    className={`rounded-lg p-3 text-sm font-medium ${
                      detalle.completo
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    }`}
                  >
                    {detalle.completo
                      ? 'Expediente completo — todos los documentos requeridos están verificados.'
                      : 'Expediente incompleto — aún hay documentos requeridos sin verificar.'}
                  </div>
                )}

                {/* Documentos agrupados por sección */}
                <div className="space-y-8">
                  {agruparItemsPorSeccion(detalle?.items ?? [], secciones).map(({ seccion, items: grupo }) => (
                    <div key={seccion}>
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-base font-semibold text-gray-700 uppercase tracking-wide">{seccion}</h2>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <div className="grid gap-4">
                        {grupo.map((item) => {
                    const doc = item.documento
                    const estadoConfig = doc ? ESTADO_CONFIG[doc.estado] : null
                    const puedeProcesar = doc && ['PENDIENTE', 'PROXIMO_A_VENCER', 'VENCIDO'].includes(doc.estado)
                    const puedeRevertir = doc && ['VERIFICADO', 'RECHAZADO'].includes(doc.estado)

                    return (
                      <div key={item.tipo.id} className="bg-white rounded-lg shadow border border-gray-100 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FaFilePdf className="text-red-500 flex-shrink-0" />
                              <span className="font-semibold text-gray-900">{item.tipo.nombre}</span>
                              {item.tipo.requerido && (
                                <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                                  Requerido
                                </span>
                              )}
                            </div>

                            {doc ? (
                              <div className="space-y-1">
                                {estadoConfig && (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoConfig.color}`}>
                                    {estadoConfig.label}
                                  </span>
                                )}
                                <div className="text-xs text-gray-500 flex flex-wrap gap-3 mt-1">
                                  <span>{doc.nombreOriginal}</span>
                                  {doc.fechaVigencia && (
                                    <span>Vence: <strong>{formatFecha(doc.fechaVigencia)}</strong></span>
                                  )}
                                  <span>Subido: {formatFecha(doc.createdAt)}</span>
                                  {doc.verificadoEn && <span>Verificado: {formatFecha(doc.verificadoEn)}</span>}
                                </div>
                                {doc.motivoRechazo && (
                                  <div className="mt-2 bg-red-50 border border-red-100 rounded p-2 text-xs text-red-700">
                                    <strong>Motivo de rechazo:</strong> {doc.motivoRechazo}
                                  </div>
                                )}
                                {/* Versión anterior */}
                                {doc.archivoAnterior && (
                                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                                    <span>Versión anterior: {doc.nombreOriginalAnterior}</span>
                                    <a
                                      href={expedientesService.getArchivoUrl(doc.archivoAnterior)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-600"
                                    >
                                      <FaEye />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">Sin documento</span>
                            )}
                          </div>

                          {/* Acciones */}
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            {doc && (
                              <a
                                href={expedientesService.getArchivoUrl(doc.archivo)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                              >
                                <FaEye /> Ver PDF
                              </a>
                            )}
                            {puedeProcesar && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => abrirVerificar(item, 'VERIFICADO')}
                                  title="Verificar documento"
                                >
                                  <FaCheck className="text-green-500" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => abrirVerificar(item, 'RECHAZADO')}
                                  title="Rechazar documento"
                                >
                                  <FaTrash className="text-red-500" />
                                </Button>
                              </>
                            )}
                            {puedeRevertir && isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirVerificar(item, 'REVERTIR')}
                                title="Revertir estado (solo Admin)"
                              >
                                <FaUndo className="text-orange-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modal verificar / rechazar */}
      <Modal
        isOpen={isVerificarOpen}
        onClose={cerrarModalVerificar}
        title={
          accionDoc === 'VERIFICADO' ? `Verificar: ${docSeleccionado?.nombre}` :
          accionDoc === 'REVERTIR'   ? `Revertir: ${docSeleccionado?.nombre}` :
          `Rechazar: ${docSeleccionado?.nombre}`
        }
        size="sm"
      >
        <div className="space-y-4">
          {accionDoc === 'RECHAZADO' && (
            <Input
              label="Motivo de rechazo *"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Describe el problema con el documento..."
            />
          )}
          {accionDoc === 'VERIFICADO' && (
            <p className="text-sm text-gray-600">¿Confirmas que el documento <strong>{docSeleccionado?.nombre}</strong> es correcto y válido?</p>
          )}
          {accionDoc === 'REVERTIR' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Esto cambiará el estado de <strong>{docSeleccionado?.nombre}</strong> a <span className="text-red-600 font-medium">Rechazado</span> y el empleado deberá subir el documento nuevamente.
              </p>
              <p className="text-xs text-gray-400">Se registrará el motivo: "Revertido por RH — el documento debe ser reemplazado".</p>
            </div>
          )}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={cerrarModalVerificar}>Cancelar</Button>
            <Button
              variant={accionDoc === 'VERIFICADO' ? 'secondary' : 'danger'}
              isLoading={verificarMutation.isPending}
              onClick={() => {
                if (accionDoc === 'RECHAZADO' && !motivoRechazo.trim()) {
                  toast.error('El motivo de rechazo es requerido')
                  return
                }
                verificarMutation.mutate()
              }}
            >
              {accionDoc === 'VERIFICADO' ? 'Verificar' : accionDoc === 'REVERTIR' ? 'Revertir' : 'Rechazar'}
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}
