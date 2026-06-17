import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { FaFileContract, FaUpload, FaDownload, FaTrash, FaPlus, FaLock, FaExclamationTriangle } from 'react-icons/fa'
import { createColumnHelper } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { MainLayout } from '../layouts/MainLayout'
import { DataTable } from '../components/ui/DataTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'

import { useAuth } from '../context/AuthContext'
import { contratosService } from '../services/contratos.service'
import type { Contrato } from '../services/contratos.service'
import { expedientesService } from '../services/expedientes.service'

// ── Esquema formulario subir contrato (RH/ADMIN) ──────────────────────────────

const subirSchema = z.object({
  titulo: z.string().min(2, 'El título es requerido'),
  empleadoId: z.number().positive('Selecciona un empleado'),
})
type SubirForm = z.infer<typeof subirSchema>

const formatFecha = (fecha: string) =>
  new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })

const columnHelper = createColumnHelper<Contrato>()

// ── Vista EMPLEADO ────────────────────────────────────────────────────────────

const VistaEmpleado = () => {
  const { data: expediente, isLoading: loadingExp } = useQuery({
    queryKey: ['mi-expediente-contratos'],
    queryFn: expedientesService.getMiExpediente,
  })

  const { data: contratos = [], isLoading: loadingContratos, error } = useQuery({
    queryKey: ['mis-contratos'],
    queryFn: contratosService.misContratos,
    retry: false,
  })

  const [descargando, setDescargando] = useState<number | null>(null)

  const handleDescargar = async (contrato: Contrato) => {
    setDescargando(contrato.id)
    try {
      await contratosService.descargarContrato(contrato.id, contrato.nombreOriginal)
    } catch {
      toast.error('Error al descargar el contrato')
    } finally {
      setDescargando(null)
    }
  }

  if (loadingExp || loadingContratos) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Expediente incompleto - bloquear acceso
  if (expediente && !expediente.completo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <FaLock className="text-gray-400 h-14 w-14" />
        <h2 className="text-xl font-semibold text-gray-700">Acceso restringido</h2>
        <p className="text-gray-500 max-w-md">
          Para acceder a tus contratos, necesitas completar tu expediente. Sube todos los documentos requeridos y espera que sean verificados por Recursos Humanos.
        </p>
      </div>
    )
  }

  // Error de la API (expediente incompleto desde backend)
  if (error) {
    const err = error as any
    if (err.response?.data?.expedienteIncompleto) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <FaLock className="text-gray-400 h-14 w-14" />
          <h2 className="text-xl font-semibold text-gray-700">Acceso restringido</h2>
          <p className="text-gray-500 max-w-md">
            {err.response.data.error}
          </p>
        </div>
      )
    }
    return <p className="text-red-600 text-center py-10">Error al cargar contratos</p>
  }

  return (
    <div className="space-y-4">
      {contratos.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <FaFileContract className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p>No tienes contratos disponibles aún.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {contratos.map((c) => (
            <div key={c.id} className="bg-white rounded-lg shadow border border-gray-100 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">{c.titulo}</p>
                <p className="text-xs text-gray-500">{c.nombreOriginal} · {formatFecha(c.createdAt)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                isLoading={descargando === c.id}
                onClick={() => handleDescargar(c)}
              >
                <FaDownload className="mr-1" /> Descargar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vista RH / ADMIN ──────────────────────────────────────────────────────────

const VistaRH = () => {
  const queryClient = useQueryClient()
  const [isSubirOpen, setIsSubirOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<Contrato | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [archivoError, setArchivoError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SubirForm>({ resolver: zodResolver(subirSchema) as any })

  // Empleados (usuarios con expediente)
  const { data: expedientes = [] } = useQuery({
    queryKey: ['expedientes-lista-contratos'],
    queryFn: expedientesService.listarExpedientes,
  })

  const empleadosCompletos = expedientes.filter((e) => e.completo)

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos-lista'],
    queryFn: () => contratosService.listarContratos(),
  })

  const subirMutation = useMutation({
    mutationFn: (data: SubirForm) =>
      contratosService.subirContrato({ empleadoId: data.empleadoId, titulo: data.titulo, archivo: archivo! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-lista'] })
      toast.success('Contrato subido correctamente')
      setIsSubirOpen(false)
      reset()
      setArchivo(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al subir contrato'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => contratosService.eliminarContrato(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-lista'] })
      toast.success('Contrato eliminado')
      setIsDeleteOpen(false)
      setSelected(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al eliminar'),
  })

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

  const onSubmit = (data: SubirForm) => {
    if (!archivo) { setArchivoError('Selecciona un archivo PDF'); return }
    subirMutation.mutate(data)
  }

  const columns = [
    columnHelper.accessor('empleado', {
      header: 'Empleado',
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900">{info.getValue()?.nombre}</p>
          <p className="text-xs text-gray-500">{info.getValue()?.correo}</p>
        </div>
      ),
    }),
    columnHelper.accessor('titulo', {
      header: 'Título',
      cell: (info) => <span className="text-gray-800">{info.getValue()}</span>,
    }),
    columnHelper.accessor('nombreOriginal', {
      header: 'Archivo',
      cell: (info) => <span className="text-gray-500 text-sm">{info.getValue()}</span>,
    }),
    columnHelper.accessor('createdAt', {
      header: 'Fecha',
      cell: (info) => <span className="text-sm text-gray-500">{formatFecha(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSelected(row.original); setIsDeleteOpen(true) }}
            title="Eliminar contrato"
          >
            <FaTrash className="text-red-500" />
          </Button>
        </div>
      ),
    }),
  ]

  return (
    <div>
      {/* Aviso si no hay empleados con expediente completo */}
      {empleadosCompletos.length === 0 && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 mb-4">
          <FaExclamationTriangle className="flex-shrink-0" />
          No hay empleados con expediente completo. Los contratos solo pueden subirse a empleados verificados.
        </div>
      )}

      <div className="flex justify-end mb-4">
        <Button onClick={() => { reset(); setArchivo(null); setArchivoError(''); setIsSubirOpen(true) }} className="flex items-center">
          <FaPlus className="mr-2" /> Subir contrato
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <DataTable columns={columns} data={contratos} />
      )}

      {/* Modal subir */}
      <Modal isOpen={isSubirOpen} onClose={() => setIsSubirOpen(false)} title="Subir contrato" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Selección empleado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empleado *</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-sm"
              onChange={(e) => setValue('empleadoId', Number(e.target.value))}
              defaultValue=""
            >
              <option value="" disabled>Selecciona un empleado...</option>
              {empleadosCompletos.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombre} — {emp.correo}</option>
              ))}
            </select>
            {errors.empleadoId && <p className="mt-1 text-xs text-red-600">{errors.empleadoId.message}</p>}
          </div>

          <Input label="Título del contrato *" {...register('titulo')} error={errors.titulo?.message} />

          {/* Archivo PDF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF *</label>
            <div
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                archivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary'
              }`}
              onClick={() => document.getElementById('contrato-pdf-input')?.click()}
            >
              <FaFileContract className={`mx-auto h-7 w-7 mb-2 ${archivo ? 'text-green-500' : 'text-gray-400'}`} />
              {archivo ? (
                <p className="text-sm text-green-700 font-medium">{archivo.name}</p>
              ) : (
                <p className="text-sm text-gray-500">Haz clic para seleccionar un PDF (máx. 10MB)</p>
              )}
              <input id="contrato-pdf-input" type="file" accept=".pdf" className="hidden" onChange={handleArchivoChange} />
            </div>
            {archivoError && <p className="mt-1 text-xs text-red-600">{archivoError}</p>}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsSubirOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={subirMutation.isPending}>
              <FaUpload className="mr-1" /> Subir
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal eliminar */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Eliminar contrato" size="sm">
        <p className="text-gray-600 mb-4">¿Confirmas eliminar el contrato <strong>{selected?.titulo}</strong>?</p>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button variant="danger" isLoading={eliminarMutation.isPending} onClick={() => selected && eliminarMutation.mutate(selected.id)}>
              Eliminar
            </Button>
          </div>
      </Modal>
    </div>
  )
}

// ── Página principal (role-aware) ─────────────────────────────────────────────

export const Contratos = () => {
  const { hasRole } = useAuth()
  const esEmpleado = hasRole('EMPLEADO')

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Contratos</h1>
        </div>

        {esEmpleado ? <VistaEmpleado /> : <VistaRH />}
      </div>
    </MainLayout>
  )
}
