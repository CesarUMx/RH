import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { FaPlus, FaDownload, FaCopy, FaCheck, FaSearch, FaFileExport, FaFileImport, FaUserTie, FaTrash, FaEdit } from 'react-icons/fa'
import { createColumnHelper } from '@tanstack/react-table'

import { MainLayout } from '../layouts/MainLayout'
import { DataTable } from '../components/ui/DataTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'

import { departamentosService } from '../services/departamentos.service'
import type { Departamento, MiembroDepartamento } from '../services/departamentos.service'
import empleadosService from '../services/empleados.service'
import type {
  RegistroIngreso,
  CrearEmpleadoDto,
  CrearEmpleadoResult,
  TipoColaborador,
  ImportarEmpleadosResult,
  ActualizarEmpleadoDto,
} from '../services/empleados.service'
import { TIPO_COLABORADOR_LABEL, TIPOS_COLABORADOR } from '../services/empleados.service'

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

interface CandidatoCorreo { correo: string; disponible: boolean }

interface FormState {
  primerNombre: string
  segundoNombre: string
  primerApellido: string
  segundoApellido: string
  tipo: TipoColaborador
  fechaNacimiento: string
  numColaborador: string
  fechaIngreso: string
  puesto: string
  departamentoId: number | ''
  esExtranjero: boolean
}

const initForm: FormState = {
  primerNombre: '', segundoNombre: '',
  primerApellido: '', segundoApellido: '',
  tipo: 'ADMINISTRATIVO', fechaNacimiento: '', numColaborador: '',
  fechaIngreso: '', puesto: '', departamentoId: '',
  esExtranjero: false,
}

const columnHelper = createColumnHelper<RegistroIngreso>()

// ─── Badge de tipo ────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<TipoColaborador, string> = {
  ADMINISTRATIVO: 'bg-blue-100 text-blue-700',
  GUARDIA: 'bg-orange-100 text-orange-700',
  LIMPIEZA_MANTENIMIENTO: 'bg-green-100 text-green-700',
  DOCENTE: 'bg-purple-100 text-purple-700',
}

// ─── Componente ──────────────────────────────────────────────────────────────

export const EmpleadosNuevos = () => {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoColaborador | ''>('')

  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(initForm)
  const [candidatos, setCandidatos] = useState<CandidatoCorreo[]>([])
  const [correoSeleccionado, setCorreoSeleccionado] = useState('')
  const [correoManual, setCorreoManual] = useState('')

  const [exitoOpen, setExitoOpen] = useState(false)
  const [resultado, setResultado] = useState<CrearEmpleadoResult | null>(null)
  const [copiado, setCopiado] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportarEmpleadosResult | null>(null)

  const [bajaOpen, setBajaOpen] = useState(false)
  const [bajaEmpleado, setBajaEmpleado] = useState<{ userId: number; nombre: string; departamentoId: number | null } | null>(null)
  const [wizardDestinatarios, setWizardDestinatarios] = useState<string[]>([])
  const [bajaDestinatarios, setBajaDestinatarios] = useState<string[]>([])

  const [editOpen, setEditOpen] = useState(false)
  const [editEmpleado, setEditEmpleado] = useState<RegistroIngreso | null>(null)
  const [editForm, setEditForm] = useState<ActualizarEmpleadoDto>({})

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: empleadosData, isLoading } = useQuery({
    queryKey: ['empleados', search, tipoFiltro],
    queryFn: () =>
      empleadosService.listar({
        q: search || undefined,
        tipo: tipoFiltro || undefined,
        pageSize: 500,
      }),
  })

  const { data: departamentos = [] } = useQuery<Departamento[]>({
    queryKey: ['departamentos'],
    queryFn: departamentosService.getAll,
    enabled: wizardOpen || editOpen,
  })

  const { data: miembrosWizard = [], isLoading: loadingMiembrosWizard } = useQuery<MiembroDepartamento[]>({
    queryKey: ['depto-miembros', form.departamentoId],
    queryFn: () => departamentosService.getMiembros(form.departamentoId as number),
    enabled: wizardOpen && !!form.departamentoId,
  })

  const { data: miembrosBaja = [] } = useQuery<MiembroDepartamento[]>({
    queryKey: ['depto-miembros', bajaEmpleado?.departamentoId],
    queryFn: () => departamentosService.getMiembros(bajaEmpleado!.departamentoId!),
    enabled: bajaOpen && !!bajaEmpleado?.departamentoId,
  })

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const sugerirMut = useMutation({
    mutationFn: () =>
      empleadosService.sugerirCorreo({
        primerNombre: form.primerNombre,
        segundoNombre: form.segundoNombre || undefined,
        primerApellido: form.primerApellido,
        segundoApellido: form.segundoApellido || undefined,
        tipo: form.tipo,
      }),
    onSuccess: (data) => {
      setCandidatos(data.candidatos)
      const primera = data.candidatos.find((c) => c.disponible)
      setCorreoSeleccionado(primera?.correo ?? '')
      setCorreoManual('')
      setStep(2)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al generar sugerencias'),
  })

  const crearMut = useMutation({
    mutationFn: (dto: CrearEmpleadoDto) => empleadosService.crear(dto),
    onSuccess: (data) => {
      setResultado(data)
      setWizardOpen(false)
      setExitoOpen(true)
      qc.invalidateQueries({ queryKey: ['empleados'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al crear empleado'),
  })

  const descargarMut = useMutation({
    mutationFn: ({ userId, nombre }: { userId: number; nombre: string }) =>
      empleadosService.descargarCredencialesEmpleado(userId, nombre),
    onError: () => toast.error('Error al descargar credenciales'),
  })

  const importarMut = useMutation({
    mutationFn: (archivo: File) => empleadosService.importar(archivo),
    onSuccess: (data) => {
      setImportResult(data)
      setImportOpen(false)
      qc.invalidateQueries({ queryKey: ['empleados'] })
      if (data.creados > 0) toast.success(`${data.creados} empleado(s) importado(s)`)
      if (data.errores.length > 0) toast.error(`${data.errores.length} fila(s) con error`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al importar'),
  })

  const darDeBajaMut = useMutation({
    mutationFn: ({ userId, destinatariosExtra }: { userId: number; destinatariosExtra: string[] }) =>
      empleadosService.darDeBaja(userId, destinatariosExtra),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      setBajaOpen(false)
      setBajaEmpleado(null)
      setBajaDestinatarios([])
      toast.success('Empleado dado de baja')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al dar de baja'),
  })

  const editarMut = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: ActualizarEmpleadoDto }) =>
      empleadosService.actualizar(userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      setEditOpen(false)
      setEditEmpleado(null)
      toast.success('Datos actualizados')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al actualizar'),
  })

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const correoFinal = correoManual.trim() || correoSeleccionado

  const nombreCompleto = [
    form.primerNombre,
    form.segundoNombre,
    form.primerApellido,
    form.segundoApellido,
  ].filter(Boolean).join(' ')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((f) => ({
      ...f,
      [name]: name === 'departamentoId' ? (value === '' ? '' : parseInt(value)) : value,
    }))
  }

  const abrirWizard = () => {
    setForm(initForm)
    setCandidatos([])
    setCorreoSeleccionado('')
    setCorreoManual('')
    setWizardDestinatarios([])
    setStep(1)
    setWizardOpen(true)
  }

  const cerrarWizard = () => {
    setWizardOpen(false)
    setStep(1)
    setWizardDestinatarios([])
  }

  const handlePaso1 = (e: React.FormEvent) => {
    e.preventDefault()
    sugerirMut.mutate()
  }

  const handlePaso2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!correoFinal) return
    setStep(3)
  }

  const handleCrear = (e: React.FormEvent) => {
    e.preventDefault()
    const correoParaCrear = correoFinal
    if (!correoParaCrear) {
      toast.error('No se pudo determinar el correo institucional')
      return
    }
    crearMut.mutate({
      nombre: nombreCompleto,
      primerNombre: form.primerNombre,
      segundoNombre: form.segundoNombre || undefined,
      primerApellido: form.primerApellido,
      segundoApellido: form.segundoApellido || undefined,
      tipo: form.tipo,
      fechaNacimiento: form.fechaNacimiento,
      numColaborador: form.numColaborador,
      fechaIngreso: form.fechaIngreso,
      puesto: form.puesto,
      departamentoId: form.departamentoId as number,
      correoInstitucional: correoParaCrear,
      destinatariosExtra: wizardDestinatarios,
      esExtranjero: form.esExtranjero,
    })
  }

  const copiar = () => {
    if (!resultado) return
    navigator.clipboard.writeText(resultado.passwordTemporal)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const deptoNombre =
    (departamentos as Departamento[]).find((d) => d.id === form.departamentoId)?.nombre ?? '—'

  const abrirEditar = (emp: RegistroIngreso) => {
    setEditEmpleado(emp)
    const nombrePartes = emp.nombre.trim().split(/\s+/)
    setEditForm({
      primerNombre:    nombrePartes[0] ?? '',
      segundoNombre:   nombrePartes.length === 4 ? nombrePartes[1] : '',
      primerApellido:  nombrePartes.length === 4 ? nombrePartes[2] : nombrePartes[1] ?? '',
      segundoApellido: nombrePartes.length === 4 ? nombrePartes[3] : nombrePartes[2] ?? '',
      tipo:            emp.tipo ?? undefined,
      fechaNacimiento: emp.fechaNacimiento ? emp.fechaNacimiento.slice(0, 10) : '',
      numColaborador:  emp.numColaborador ?? '',
      fechaIngreso:    emp.fechaIngreso ? emp.fechaIngreso.slice(0, 10) : '',
      puesto:          emp.puesto ?? '',
      departamentoId:  emp.departamentoId ?? undefined,
    })
    setEditOpen(true)
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setEditForm((f) => ({
      ...f,
      [name]: name === 'departamentoId' ? (value === '' ? undefined : parseInt(value)) : value,
    }))
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editEmpleado) return
    const payload: ActualizarEmpleadoDto = { ...editForm }
    if (!payload.password?.trim()) delete payload.password
    editarMut.mutate({ userId: editEmpleado.userId, data: payload })
  }

  // ─── Tabla ─────────────────────────────────────────────────────────────────

  const empleadosFiltrados = useMemo(() => empleadosData?.data ?? [], [empleadosData])

  const columns: any[] = [
    columnHelper.accessor('nombre', { header: 'Nombre' }),
    columnHelper.accessor('correo', {
      header: 'Correo',
      cell: (info) => <span className="text-xs font-mono">{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('tipo', {
      header: 'Tipo',
      cell: (info) => {
        const t = info.getValue()
        if (!t) return <span className="text-gray-400 text-xs">—</span>
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[t]}`}>
            {TIPO_COLABORADOR_LABEL[t]}
          </span>
        )
      },
    }),
    columnHelper.accessor('numColaborador', {
      header: 'No. Colaborador',
      cell: (info) => info.getValue() ?? <span className="text-gray-400">—</span>,
    }),
    columnHelper.accessor('puesto', {
      header: 'Puesto',
      cell: (info) => info.getValue() ?? <span className="text-gray-400">—</span>,
    }),
    columnHelper.accessor('fechaIngreso', {
      header: 'Ingreso',
      cell: (info) =>
        info.getValue()
          ? new Date(info.getValue()!.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX')
          : <span className="text-gray-400">—</span>,
    }),
    columnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: (info) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            title="Editar datos"
            onClick={() => abrirEditar(info.row.original)}
          >
            <FaEdit className="text-blue-500" />
          </Button>
          {info.row.original.archivoCredenciales ? (
            <Button
              variant="outline"
              size="sm"
              title="Descargar credenciales"
              onClick={() =>
                descargarMut.mutate({
                  userId: info.row.original.userId,
                  nombre: info.row.original.nombre,
                })
              }
            >
              <FaDownload className="text-primary" />
            </Button>
          ) : (
            <span className="text-gray-400 text-xs px-2">—</span>
          )}
          <Button
            variant="outline"
            size="sm"
            title="Dar de baja"
            onClick={() => {
              setBajaEmpleado({
                userId: info.row.original.userId,
                nombre: info.row.original.nombre,
                departamentoId: info.row.original.departamentoId,
              })
              setBajaDestinatarios([])
              setBajaOpen(true)
            }}
          >
            <FaTrash className="text-red-500" />
          </Button>
        </div>
      ),
    }),
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="container mx-auto">

        {/* Encabezado */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Empleados</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setImportFile(null); setImportResult(null); setImportOpen(true) }}
              className="flex items-center gap-2"
              title="Importar empleados desde CSV"
            >
              <FaFileImport className="text-blue-600" />
              Importar
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                empleadosService.exportar({
                  q: search || undefined,
                  tipo: tipoFiltro || undefined,
                })
              }
              className="flex items-center gap-2"
              title="Descargar CSV con los filtros actuales"
            >
              <FaFileExport className="text-green-600" />
              Exportar
            </Button>
            <Button onClick={abrirWizard} className="flex items-center gap-2">
              <FaPlus />
              Registrar empleado
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex flex-1">
            <Input
              placeholder="Buscar por nombre, correo, No. colaborador o puesto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-r-none"
            />
            <Button type="button" className="rounded-l-none">
              <FaSearch />
            </Button>
          </div>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as TipoColaborador | '')}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos los tipos</option>
            {TIPOS_COLABORADOR.map((t) => (
              <option key={t} value={t}>{TIPO_COLABORADOR_LABEL[t]}</option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-2">
              {empleadosData?.pagination.total ?? 0} empleado(s) encontrado(s)
            </div>
            <DataTable columns={columns} data={empleadosFiltrados} />
          </>
        )}

        {/* ─── Modal Wizard ────────────────────────────────────── */}
        <Modal
          isOpen={wizardOpen}
          onClose={cerrarWizard}
          title={
            step === 1
              ? 'Registrar empleado — Datos'
              : step === 2
              ? 'Registrar empleado — Correo institucional'
              : 'Registrar empleado — Confirmar'
          }
          size="lg"
        >
          {/* Indicador de pasos */}
          <div className="flex items-center gap-2 mb-6">
            {([1, 2, 3] as Step[]).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s
                      ? 'bg-primary text-white'
                      : step > s
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > s ? <FaCheck /> : i + 1}
                </div>
                {i < arr.length - 1 && <div className="w-10 h-0.5 bg-gray-200" />}
              </div>
            ))}
            <span className="ml-3 text-sm text-gray-500">
              {step === 1 && 'Datos del colaborador'}
              {step === 2 && 'Correo institucional'}
              {step === 3 && 'Confirmar registro'}
            </span>
          </div>

          {/* ── Paso 1: Datos ──────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handlePaso1} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Primer nombre *" name="primerNombre" value={form.primerNombre} onChange={handleChange} required />
                <Input label="Segundo nombre" name="segundoNombre" value={form.segundoNombre} onChange={handleChange} />
                <Input label="Primer apellido *" name="primerApellido" value={form.primerApellido} onChange={handleChange} required />
                <Input label="Segundo apellido" name="segundoApellido" value={form.segundoApellido} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    name="tipo"
                    value={form.tipo}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {TIPOS_COLABORADOR.map((t) => (
                      <option key={t} value={t}>{TIPO_COLABORADOR_LABEL[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento *</label>
                  <select
                    name="departamentoId"
                    value={form.departamentoId}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Seleccionar...</option>
                    {(departamentos as Departamento[]).filter((d) => d.activo).map((d) => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
                <Input label="No. Colaborador *" name="numColaborador" value={form.numColaborador} onChange={handleChange} required />
                <Input label="Puesto *" name="puesto" value={form.puesto} onChange={handleChange} required />
                <Input type="date" label="Fecha de nacimiento *" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} required />
                <Input type="date" label="Fecha de ingreso *" name="fechaIngreso" value={form.fechaIngreso} onChange={handleChange} required />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.esExtranjero}
                  onChange={(e) => setForm((f) => ({ ...f, esExtranjero: e.target.checked }))}
                  className="h-4 w-4 text-primary rounded border-gray-300"
                />
                El empleado es extranjero (afecta los documentos requeridos en su expediente)
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={cerrarWizard}>Cancelar</Button>
                <Button type="submit" isLoading={sugerirMut.isPending}>
                  Siguiente
                </Button>
              </div>
            </form>
          )}

          {/* ── Paso 2: Correo institucional ──────────────────── */}
          {step === 2 && (
            <form onSubmit={handlePaso2} className="space-y-4">
              <p className="text-sm text-gray-600">Selecciona un correo o escribe uno manualmente:</p>
              <div className="space-y-2">
                {candidatos.map((c) => (
                  <label
                    key={c.correo}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-md border cursor-pointer transition-colors ${
                      correoSeleccionado === c.correo && !correoManual
                        ? 'border-primary bg-primary/5'
                        : c.disponible
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-100 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correoOpt"
                      value={c.correo}
                      checked={correoSeleccionado === c.correo && !correoManual}
                      onChange={() => { setCorreoSeleccionado(c.correo); setCorreoManual('') }}
                      disabled={!c.disponible}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm font-mono flex-1">{c.correo}</span>
                    {c.disponible
                      ? <span className="text-xs text-green-600 font-medium">Disponible</span>
                      : <span className="text-xs text-red-500 font-medium">En uso</span>}
                  </label>
                ))}
              </div>
              <Input
                label="Correo manual"
                type="email"
                value={correoManual}
                onChange={(e) => setCorreoManual(e.target.value)}
                placeholder="usuario@mondragonmexico.edu.mx"
              />
              <div className="flex justify-between gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>← Regresar</Button>
                <Button type="submit" disabled={!correoFinal}>Siguiente</Button>
              </div>
            </form>
          )}

          {/* ── Paso 3: Confirmar ──────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={handleCrear} className="space-y-4">
              <p className="text-sm text-gray-600">Revisa los datos antes de crear el registro:</p>
              <div className="bg-gray-50 rounded-md border border-gray-200 p-4 text-sm space-y-2">
                {[
                  ['Nombre completo', nombreCompleto],
                  ['Tipo', TIPO_COLABORADOR_LABEL[form.tipo]],
                  ['Correo institucional', correoFinal],
                  ['Departamento', deptoNombre],
                  ['No. Colaborador', form.numColaborador],
                  ['Puesto', form.puesto],
                  ['Fecha de nacimiento', form.fechaNacimiento ? new Date(form.fechaNacimiento + 'T12:00:00').toLocaleDateString('es-MX') : '—'],
                  ['Fecha de ingreso', form.fechaIngreso ? new Date(form.fechaIngreso + 'T12:00:00').toLocaleDateString('es-MX') : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-2 gap-2">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                Al confirmar se creará la cuenta de Google Workspace, el usuario en el sistema, el archivo de credenciales y se enviarán notificaciones por correo.
              </p>

              {/* Destinatarios adicionales */}
              {form.departamentoId !== '' && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Notificar a miembros del departamento <span className="text-gray-400">(opcional)</span>
                  </p>
                  {loadingMiembrosWizard ? (
                    <p className="text-xs text-gray-400 py-2">Cargando miembros...</p>
                  ) : miembrosWizard.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No hay miembros registrados en este departamento.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-md divide-y max-h-36 overflow-y-auto">
                      {miembrosWizard.map((m) => (
                        <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-primary rounded border-gray-300"
                            checked={wizardDestinatarios.includes(m.correo)}
                            onChange={(e) =>
                              setWizardDestinatarios((prev) =>
                                e.target.checked ? [...prev, m.correo] : prev.filter((c) => c !== m.correo)
                              )
                            }
                          />
                          <span className="flex-1 truncate">{m.nombre}</span>
                          <span className="text-xs text-gray-400 font-mono truncate">{m.correo}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {crearMut.isError && (
                <p className="text-sm text-red-600">
                  {(crearMut.error as any)?.response?.data?.error ?? 'Error al crear empleado'}
                </p>
              )}
              <div className="flex justify-between gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>← Regresar</Button>
                <Button type="submit" isLoading={crearMut.isPending}>Confirmar y crear</Button>
              </div>
            </form>
          )}
        </Modal>

        {/* ─── Modal Éxito ─────────────────────────────────────── */}
        <Modal isOpen={exitoOpen} onClose={() => setExitoOpen(false)} title="Empleado registrado">
          {resultado && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <FaUserTie className="text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{resultado.user.nombre}</p>
                  <p className="text-sm text-gray-500 font-mono">{resultado.cuenta.correoInstitucional}</p>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <p className="text-xs text-gray-500 mb-1">Contraseña temporal</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-gray-800 flex-1">
                    {resultado.passwordTemporal}
                  </span>
                  <button onClick={copiar} className="text-gray-400 hover:text-primary transition-colors" title="Copiar contraseña">
                    {copiado ? <FaCheck className="text-green-600" /> : <FaCopy />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Se enviaron notificaciones por correo a SRH y al coordinador del departamento.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => descargarMut.mutate({ userId: resultado.user.id, nombre: resultado.user.nombre })}
                  isLoading={descargarMut.isPending}
                  className="flex items-center gap-2"
                >
                  <FaDownload /> Descargar credenciales
                </Button>
                <Button onClick={() => { setExitoOpen(false); abrirWizard() }} className="flex items-center gap-2">
                  <FaPlus /> Registrar otro
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ─── Modal Importar CSV ──────────────────────────────── */}
        <Modal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          title="Importar empleados desde CSV"
          size="lg"
        >
          <div className="space-y-4">
            {/* Instrucciones */}
            <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800 space-y-1">
              <p className="font-medium">Formato del archivo CSV:</p>
              <p className="font-mono text-xs">primerNombre, segundoNombre, primerApellido, segundoApellido, tipo, fechaNacimiento, numColaborador, fechaIngreso, puesto, departamento, correoInstitucional, contrasena</p>
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                <li><strong>tipo:</strong> ADMINISTRATIVO | GUARDIA | LIMPIEZA_MANTENIMIENTO | DOCENTE</li>
                <li><strong>fechas:</strong> DD/MM/YYYY</li>
                <li><strong>correoInstitucional:</strong> opcional — se auto-genera si se deja vacío</li>
                <li><strong>contrasena:</strong> opcional — se genera aleatoriamente si se deja vacío</li>
                <li>Los campos <em>segundoNombre</em> y <em>segundoApellido</em> son opcionales</li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={empleadosService.descargarPlantilla}
              className="flex items-center gap-2 w-full justify-center"
            >
              <FaDownload className="text-green-600" /> Descargar plantilla de ejemplo
            </Button>

            {/* File input */}
            {!importResult && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar archivo CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
              </div>
            )}

            {/* Resultado */}
            {importResult && (
              <div className="space-y-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700 font-medium">{importResult.creados} creado(s)</span>
                  <span className="text-gray-400">de {importResult.total} filas</span>
                  {importResult.omitidos > 0 && (
                    <span className="text-red-600 font-medium">{importResult.omitidos} error(es)</span>
                  )}
                </div>
                {importResult.errores.length > 0 && (
                  <div className="border border-red-200 rounded-md overflow-hidden">
                    <div className="bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Filas con error</div>
                    <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
                      {importResult.errores.map((e) => (
                        <div key={e.linea} className="px-3 py-2 text-xs">
                          <span className="font-mono text-gray-500 mr-2">Fila {e.linea}</span>
                          <span className="text-gray-700 mr-2">{e.nombre}</span>
                          <span className="text-red-600">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {importResult ? (
                <Button onClick={() => { setImportFile(null); setImportResult(null) }}>
                  Importar otro archivo
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
                  <Button
                    disabled={!importFile}
                    isLoading={importarMut.isPending}
                    onClick={() => importFile && importarMut.mutate(importFile)}
                    className="flex items-center gap-2"
                  >
                    <FaFileImport /> Importar
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>

        {/* ─── Modal Confirmación de Baja ──────────────────────── */}
        <Modal
          isOpen={bajaOpen}
          onClose={() => { setBajaOpen(false); setBajaEmpleado(null); setBajaDestinatarios([]) }}
          title="Confirmar baja"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              ¿Confirmas la baja de <strong>{bajaEmpleado?.nombre}</strong>?
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md px-4 py-3 text-xs text-yellow-800 space-y-1">
              <p>Esta acción:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Marcará al usuario como <strong>inactivo</strong> en el sistema</li>
                <li>Suspenderá su cuenta de <strong>Google Workspace</strong></li>
                <li>Enviará un correo de notificación de baja a RH y a los seleccionados</li>
              </ul>
            </div>

            {/* Destinatarios adicionales */}
            {miembrosBaja.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">
                  Notificar a miembros del departamento <span className="text-gray-400">(opcional)</span>
                </p>
                <div className="border border-gray-200 rounded-md divide-y max-h-36 overflow-y-auto">
                  {miembrosBaja.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary rounded border-gray-300"
                        checked={bajaDestinatarios.includes(m.correo)}
                        onChange={(e) =>
                          setBajaDestinatarios((prev) =>
                            e.target.checked ? [...prev, m.correo] : prev.filter((c) => c !== m.correo)
                          )
                        }
                      />
                      <span className="flex-1 truncate">{m.nombre}</span>
                      <span className="text-xs text-gray-400 font-mono truncate">{m.correo}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setBajaOpen(false); setBajaEmpleado(null); setBajaDestinatarios([]) }}>
                Cancelar
              </Button>
              <Button
                isLoading={darDeBajaMut.isPending}
                onClick={() =>
                  bajaEmpleado &&
                  darDeBajaMut.mutate({ userId: bajaEmpleado.userId, destinatariosExtra: bajaDestinatarios })
                }
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmar baja
              </Button>
            </div>
          </div>
        </Modal>

        {/* ─── Modal Editar Empleado ───────────────────────────── */}
        <Modal
          isOpen={editOpen}
          onClose={() => { setEditOpen(false); setEditEmpleado(null) }}
          title={`Editar datos — ${editEmpleado?.nombre ?? ''}`}
          size="lg"
        >
          {editEmpleado && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Primer nombre" name="primerNombre" value={editForm.primerNombre ?? ''} onChange={handleEditChange} required />
                <Input label="Segundo nombre" name="segundoNombre" value={editForm.segundoNombre ?? ''} onChange={handleEditChange} />
                <Input label="Primer apellido" name="primerApellido" value={editForm.primerApellido ?? ''} onChange={handleEditChange} required />
                <Input label="Segundo apellido" name="segundoApellido" value={editForm.segundoApellido ?? ''} onChange={handleEditChange} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    name="tipo"
                    value={editForm.tipo ?? ''}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Seleccionar...</option>
                    {TIPOS_COLABORADOR.map((t) => (
                      <option key={t} value={t}>{TIPO_COLABORADOR_LABEL[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <select
                    name="departamentoId"
                    value={editForm.departamentoId ?? ''}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Sin cambio</option>
                    {(departamentos as Departamento[]).filter((d) => d.activo).map((d) => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
                <Input label="No. Colaborador" name="numColaborador" value={editForm.numColaborador ?? ''} onChange={handleEditChange} />
                <Input label="Puesto" name="puesto" value={editForm.puesto ?? ''} onChange={handleEditChange} />
                <Input type="date" label="Fecha de nacimiento" name="fechaNacimiento" value={editForm.fechaNacimiento ?? ''} onChange={handleEditChange} />
                <Input type="date" label="Fecha de ingreso" name="fechaIngreso" value={editForm.fechaIngreso ?? ''} onChange={handleEditChange} />
                <Input
                  type="password"
                  label="Nueva contraseña"
                  name="password"
                  value={editForm.password ?? ''}
                  onChange={handleEditChange}
                  placeholder="Dejar en blanco para no cambiar"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setEditOpen(false); setEditEmpleado(null) }}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={editarMut.isPending}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          )}
        </Modal>

      </div>
    </MainLayout>
  )
}

