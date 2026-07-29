import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa'
import { createColumnHelper } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { MainLayout } from '../layouts/MainLayout'
import { DataTable } from '../components/ui/DataTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'

import { expedientesService } from '../services/expedientes.service'
import type { TipoDocumento, SeccionExpediente } from '../services/expedientes.service'

// ── Schemas ───────────────────────────────────────────────────────────────────

const tipoSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().optional(),
  seccion: z.string().optional(),
  requerido: z.boolean(),
  requiereVigencia: z.boolean(),
  precisionVigencia: z.enum(['DIA', 'MES', 'ANIO']).optional(),
  condicion: z.string().optional(),
  orden: z.number().int(),
  permiteMultiple: z.boolean(),
})
type TipoForm = z.infer<typeof tipoSchema>

const seccionSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  orden: z.number().int(),
})
type SeccionForm = z.infer<typeof seccionSchema>

// ── Helper ────────────────────────────────────────────────────────────────────

function agruparPorSeccion(
  tipos: TipoDocumento[],
  secciones: SeccionExpediente[]
): { seccion: string; items: TipoDocumento[] }[] {
  const map = new Map<string, TipoDocumento[]>()
  for (const t of tipos) {
    const key = t.seccion?.trim() || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  // Ordenar items dentro de cada grupo por orden local
  for (const [, arr] of map) arr.sort((a, b) => a.orden - b.orden)
  // Ordenar grupos por SeccionExpediente.orden, luego nombre
  const ordenSeccion = (nombre: string) => {
    const s = secciones.find((x) => x.nombre === nombre)
    return s ? s.orden : 9999
  }
  const conNombre = [...map.entries()]
    .filter(([k]) => k !== '')
    .sort(([a], [b]) => ordenSeccion(a) - ordenSeccion(b) || a.localeCompare(b, 'es'))
    .map(([seccion, items]) => ({ seccion, items }))
  const sinSeccion = map.get('') ? [{ seccion: 'Sin sección', items: map.get('')! }] : []
  return [...conNombre, ...sinSeccion]
}

// ── Tab: Tipos de Documento ───────────────────────────────────────────────────

const tipoColumnHelper = createColumnHelper<TipoDocumento>()

function TabTipos({ secciones }: { secciones: SeccionExpediente[] }) {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<TipoDocumento | null>(null)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<TipoForm>({
    resolver: zodResolver(tipoSchema) as any,
    defaultValues: { requerido: false, requiereVigencia: false, orden: 0, seccion: '', permiteMultiple: false },
  })
  const watchRequerido = watch('requerido', false)
  const watchRequiereVigencia = watch('requiereVigencia', false)
  const watchPermiteMultiple = watch('permiteMultiple', false)

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ['tipos-expediente'],
    queryFn: expedientesService.getTipos,
  })
  const grupos = agruparPorSeccion(tipos, secciones)

  const crearMutation = useMutation({
    mutationFn: expedientesService.crearTipo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-expediente'] })
      toast.success('Tipo de documento creado correctamente')
      setIsCreateOpen(false)
      reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al crear'),
  })

  const actualizarMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => expedientesService.actualizarTipo(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-expediente'] })
      toast.success('Tipo actualizado correctamente')
      setIsEditOpen(false)
      setSelected(null)
      reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al actualizar'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => expedientesService.eliminarTipo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-expediente'] })
      toast.success('Tipo eliminado correctamente')
      setIsDeleteOpen(false)
      setSelected(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al eliminar'),
  })

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      expedientesService.actualizarTipo(id, { activo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-expediente'] })
      toast.success('Estado actualizado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al actualizar estado'),
  })

  const handleEdit = (tipo: TipoDocumento) => {
    setSelected(tipo)
    reset({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      seccion: tipo.seccion || '',
      requerido: tipo.requerido,
      requiereVigencia: tipo.requiereVigencia,
      precisionVigencia: (tipo.precisionVigencia as any) || 'DIA',
      condicion: tipo.condicion || '',
      orden: tipo.orden,
      permiteMultiple: tipo.permiteMultiple,
    })
    setIsEditOpen(true)
  }

  const onSubmitCrear = (data: TipoForm) =>
    crearMutation.mutate({
      ...data,
      seccion: data.seccion?.trim() || null,
      precisionVigencia: data.requiereVigencia ? (data.precisionVigencia ?? 'DIA') : null,
      condicion: data.condicion || null,
      permiteMultiple: data.permiteMultiple,
    })
  const onSubmitEditar = (data: TipoForm) => {
    if (!selected) return
    actualizarMutation.mutate({
      id: selected.id,
      data: {
        ...data,
        seccion: data.seccion?.trim() || null,
        precisionVigencia: data.requiereVigencia ? (data.precisionVigencia ?? 'DIA') : null,
        condicion: data.condicion || null,
        permiteMultiple: data.permiteMultiple,
      },
    })
  }

  const columns = [
    tipoColumnHelper.accessor('orden', { header: '#', cell: (info) => info.getValue() }),
    tipoColumnHelper.accessor('nombre', { header: 'Nombre', cell: (info) => info.getValue() }),
    tipoColumnHelper.accessor('descripcion', { header: 'Descripción', cell: (info) => info.getValue() || '—' }),
    tipoColumnHelper.accessor('requerido', {
      header: 'Requerido',
      cell: (info) => (
        <span className="flex items-center">
          {info.getValue() ? <FaCheck className="text-green-500" /> : <FaTimes className="text-red-500" />}
        </span>
      ),
    }),
    tipoColumnHelper.accessor('requiereVigencia', {
      header: 'Con Vigencia',
      cell: (info) => (
        <span className="flex items-center">
          {info.getValue() ? <FaCheck className="text-green-500" /> : <FaTimes className="text-red-500" />}
        </span>
      ),
    }),
    tipoColumnHelper.accessor('activo', {
      header: 'Activo',
      cell: (info) => (
        <span className="flex items-center">
          {info.getValue() ? <FaCheck className="text-green-500" /> : <FaTimes className="text-red-500" />}
        </span>
      ),
    }),
    tipoColumnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm"
            onClick={() => toggleActivoMutation.mutate({ id: row.original.id, activo: !row.original.activo })}
            title={row.original.activo ? 'Desactivar' : 'Activar'}>
            {row.original.activo ? <FaTimes className="text-red-500" /> : <FaCheck className="text-green-500" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleEdit(row.original)} title="Editar">
            <FaEdit className="text-primary" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSelected(row.original); setIsDeleteOpen(true) }} title="Eliminar">
            <FaTrash className="text-red-500" />
          </Button>
        </div>
      ),
    }),
  ]

  const seccionesActivas = secciones
    .filter((s) => s.activo)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { reset({ requerido: false, requiereVigencia: false, orden: 0, seccion: '' }); setIsCreateOpen(true) }}
          className="flex items-center">
          <FaPlus className="mr-2" /> Nuevo tipo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : tipos.length === 0 ? (
        <p className="text-center text-gray-500 py-10">No hay tipos configurados. Crea el primero.</p>
      ) : (
        <div className="space-y-8">
          {grupos.map(({ seccion, items }) => (
            <div key={seccion}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-semibold text-gray-700 uppercase tracking-wide">{seccion}</h2>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{items.length} tipo{items.length !== 1 ? 's' : ''}</span>
              </div>
              <DataTable columns={columns} data={items} />
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nuevo tipo de documento">
        <form onSubmit={handleSubmit(onSubmitCrear)} className="space-y-4">
          <Input label="Nombre" {...register('nombre')} error={errors.nombre?.message} />
          <Input label="Descripción" {...register('descripcion')} />
          <div>
            <label htmlFor="create-seccion" className="block text-sm font-medium text-gray-700 mb-1">Sección</label>
            <select
              id="create-seccion"
              {...register('seccion')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border px-3 py-2">
              <option value="">Sin sección</option>
              {seccionesActivas.map((s) => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <Input label="Orden de visualización" type="number" {...register('orden', { valueAsNumber: true })} error={errors.orden?.message} />
          <div className="flex items-center">
            <input type="checkbox" id="create-requerido" checked={watchRequerido}
              onChange={(e) => setValue('requerido', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
            <label htmlFor="create-requerido" className="ml-2 block text-sm text-gray-700">Requerido</label>
          </div>
          <div className="flex items-center">
            <input type="checkbox" id="create-vigencia" checked={watchRequiereVigencia}
              onChange={(e) => setValue('requiereVigencia', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
            <label htmlFor="create-vigencia" className="ml-2 block text-sm text-gray-700">Requiere vigencia</label>
          </div>
          {watchRequiereVigencia && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precisión de vigencia *</label>
              <select
                {...register('precisionVigencia')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border px-3 py-2">
                <option value="DIA">Fecha exacta (día/mes/año)</option>
                <option value="MES">Mes y año</option>
                <option value="ANIO">Solo año</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aplica a</label>
            <select
              {...register('condicion')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border px-3 py-2">
              <option value="">Todos los empleados</option>
              <option value="MEXICANO">Solo mexicanos</option>
              <option value="EXTRANJERO">Solo extranjeros</option>
            </select>
          </div>
          <div className="flex items-center">
            <input type="checkbox" id="create-multiple" checked={watchPermiteMultiple}
              onChange={(e) => setValue('permiteMultiple', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
            <label htmlFor="create-multiple" className="ml-2 block text-sm text-gray-700">Permite subir múltiples archivos (se fusionan en uno)</label>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={crearMutation.isPending}>Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Editar tipo de documento">
        <form onSubmit={handleSubmit(onSubmitEditar)} className="space-y-4">
          <Input label="Nombre" {...register('nombre')} error={errors.nombre?.message} />
          <Input label="Descripción" {...register('descripcion')} />
          <div>
            <label htmlFor="edit-seccion" className="block text-sm font-medium text-gray-700 mb-1">Sección</label>
            <select
              id="edit-seccion"
              {...register('seccion')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border px-3 py-2">
              <option value="">Sin sección</option>
              {seccionesActivas.map((s) => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <Input label="Orden" type="number" {...register('orden', { valueAsNumber: true })} error={errors.orden?.message} />
          <div className="flex items-center">
            <input type="checkbox" id="edit-requerido" checked={watchRequerido}
              onChange={(e) => setValue('requerido', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
            <label htmlFor="edit-requerido" className="ml-2 block text-sm text-gray-700">Requerido</label>
          </div>
          <div className="flex items-center">
            <input type="checkbox" id="edit-vigencia" checked={watchRequiereVigencia}
              onChange={(e) => setValue('requiereVigencia', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
            <label htmlFor="edit-vigencia" className="ml-2 block text-sm text-gray-700">Requiere vigencia</label>
          </div>
          {watchRequiereVigencia && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precisión de vigencia *</label>
              <select
                {...register('precisionVigencia')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border px-3 py-2">
                <option value="DIA">Fecha exacta (día/mes/año)</option>
                <option value="MES">Mes y año</option>
                <option value="ANIO">Solo año</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aplica a</label>
            <select
              {...register('condicion')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border px-3 py-2">
              <option value="">Todos los empleados</option>
              <option value="MEXICANO">Solo mexicanos</option>
              <option value="EXTRANJERO">Solo extranjeros</option>
            </select>
          </div>
          <div className="flex items-center">
            <input type="checkbox" id="edit-multiple" checked={watchPermiteMultiple}
              onChange={(e) => setValue('permiteMultiple', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
            <label htmlFor="edit-multiple" className="ml-2 block text-sm text-gray-700">Permite subir múltiples archivos (se fusionan en uno)</label>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={actualizarMutation.isPending}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Eliminar */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Eliminar tipo de documento">
        <p className="text-gray-600 mb-4">
          ¿Estás seguro de eliminar el tipo <strong>{selected?.nombre}</strong>?<br />
          Solo se puede eliminar si no tiene documentos asociados.
        </p>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" isLoading={eliminarMutation.isPending}
            onClick={() => selected && eliminarMutation.mutate(selected.id)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Tab: Secciones ────────────────────────────────────────────────────────────

const seccionColumnHelper = createColumnHelper<SeccionExpediente>()

function TabSecciones() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<SeccionExpediente | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SeccionForm>({
    resolver: zodResolver(seccionSchema) as any,
    defaultValues: { orden: 0 },
  })

  const { data: secciones = [], isLoading } = useQuery({
    queryKey: ['secciones-expediente'],
    queryFn: expedientesService.getSecciones,
  })

  const crearMutation = useMutation({
    mutationFn: expedientesService.crearSeccion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secciones-expediente'] })
      toast.success('Sección creada correctamente')
      setIsCreateOpen(false)
      reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al crear'),
  })

  const actualizarMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => expedientesService.actualizarSeccion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secciones-expediente'] })
      queryClient.invalidateQueries({ queryKey: ['tipos-expediente'] })
      toast.success('Sección actualizada')
      setIsEditOpen(false)
      setSelected(null)
      reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al actualizar'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => expedientesService.eliminarSeccion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secciones-expediente'] })
      toast.success('Sección eliminada')
      setIsDeleteOpen(false)
      setSelected(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al eliminar'),
  })

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      expedientesService.actualizarSeccion(id, { activo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secciones-expediente'] })
      toast.success('Estado actualizado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  const handleEdit = (s: SeccionExpediente) => {
    setSelected(s)
    reset({ nombre: s.nombre, orden: s.orden })
    setIsEditOpen(true)
  }

  const columns = [
    seccionColumnHelper.accessor('orden', { header: '#', cell: (info) => info.getValue() }),
    seccionColumnHelper.accessor('nombre', { header: 'Nombre', cell: (info) => info.getValue() }),
    seccionColumnHelper.accessor('activo', {
      header: 'Activo',
      cell: (info) => (
        <span className="flex items-center">
          {info.getValue() ? <FaCheck className="text-green-500" /> : <FaTimes className="text-red-500" />}
        </span>
      ),
    }),
    seccionColumnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm"
            onClick={() => toggleActivoMutation.mutate({ id: row.original.id, activo: !row.original.activo })}
            title={row.original.activo ? 'Desactivar' : 'Activar'}>
            {row.original.activo ? <FaTimes className="text-red-500" /> : <FaCheck className="text-green-500" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleEdit(row.original)} title="Editar">
            <FaEdit className="text-primary" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSelected(row.original); setIsDeleteOpen(true) }} title="Eliminar">
            <FaTrash className="text-red-500" />
          </Button>
        </div>
      ),
    }),
  ]

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { reset({ orden: 0 }); setIsCreateOpen(true) }} className="flex items-center">
          <FaPlus className="mr-2" /> Nueva sección
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : secciones.length === 0 ? (
        <p className="text-center text-gray-500 py-10">No hay secciones configuradas. Crea la primera.</p>
      ) : (
        <DataTable columns={columns} data={secciones} />
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nueva sección">
        <form onSubmit={handleSubmit((d) => crearMutation.mutate(d))} className="space-y-4">
          <Input label="Nombre" {...register('nombre')} error={errors.nombre?.message} />
          <Input label="Orden de visualización" type="number" {...register('orden', { valueAsNumber: true })} />
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={crearMutation.isPending}>Crear</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Editar sección">
        <form onSubmit={handleSubmit((d) => selected && actualizarMutation.mutate({ id: selected.id, data: d }))} className="space-y-4">
          <Input label="Nombre" {...register('nombre')} error={errors.nombre?.message} />
          <Input label="Orden" type="number" {...register('orden', { valueAsNumber: true })} />
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={actualizarMutation.isPending}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Eliminar sección">
        <p className="text-gray-600 mb-4">
          ¿Estás seguro de eliminar la sección <strong>{selected?.nombre}</strong>?<br />
          Los tipos de documento que la usen quedarán sin sección.
        </p>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" isLoading={eliminarMutation.isPending}
            onClick={() => selected && eliminarMutation.mutate(selected.id)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = 'tipos' | 'secciones'

export const ConfiguracionExpedientes = () => {
  const [tab, setTab] = useState<Tab>('tipos')

  const { data: secciones = [] } = useQuery({
    queryKey: ['secciones-expediente'],
    queryFn: expedientesService.getSecciones,
  })

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Configuración de Expedientes</h1>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setTab('tipos')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'tipos'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              Tipos de Documento
            </button>
            <button
              onClick={() => setTab('secciones')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'secciones'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              Secciones
            </button>
          </nav>
        </div>

        {tab === 'tipos' && <TabTipos secciones={secciones} />}
        {tab === 'secciones' && <TabSecciones />}
      </div>
    </MainLayout>
  )
}
