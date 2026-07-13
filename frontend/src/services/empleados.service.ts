import api from './api'

export type TipoColaborador = 'ADMINISTRATIVO' | 'GUARDIA' | 'LIMPIEZA_MANTENIMIENTO' | 'DOCENTE'

export const TIPO_COLABORADOR_LABEL: Record<TipoColaborador, string> = {
  ADMINISTRATIVO: 'Administrativo',
  GUARDIA: 'Guardia',
  LIMPIEZA_MANTENIMIENTO: 'Limpieza y Mantenimiento',
  DOCENTE: 'Docente Medio Tiempo',
}

export const TIPOS_COLABORADOR = Object.keys(TIPO_COLABORADOR_LABEL) as TipoColaborador[]

export interface RegistroIngreso {
  id: number | null
  userId: number
  nombre: string
  correo: string
  activo: boolean
  tipo: TipoColaborador | null
  esExtranjero: boolean
  fechaNacimiento: string | null
  numColaborador: string | null
  fechaIngreso: string | null
  puesto: string | null
  archivoCredenciales: string | null
  creadoEn: string
  creadoPor: { id: number; nombre: string } | null
  tieneRegistro: boolean
  departamentoId: number | null
}

export interface SugerirCorreoDto {
  primerNombre: string
  segundoNombre?: string
  primerApellido: string
  segundoApellido?: string
  tipo: TipoColaborador
}

export interface SugerirCorreoResult {
  candidatos: { correo: string; disponible: boolean }[]
}

export interface CrearEmpleadoDto extends SugerirCorreoDto {
  nombre: string
  fechaNacimiento: string
  numColaborador: string
  fechaIngreso: string
  puesto: string
  correoInstitucional: string
  departamentoId: number
  destinatariosExtra?: string[]
  esExtranjero?: boolean
}

export interface CrearEmpleadoResult {
  user: { id: number; nombre: string; correo: string }
  cuenta: { id: number; correoInstitucional: string }
  passwordTemporal: string
  archivoCredenciales: string
}

export interface ListaEmpleadosResult {
  data: RegistroIngreso[]
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
}

export interface ImportarEmpleadosResult {
  creados: number
  omitidos: number
  total: number
  errores: { linea: number; nombre: string; error: string }[]
}

const empleadosService = {
  sugerirCorreo: async (data: SugerirCorreoDto): Promise<SugerirCorreoResult> => {
    const res = await api.post<SugerirCorreoResult>('/empleados/sugerir-correo', data)
    return res.data
  },

  crear: async (data: CrearEmpleadoDto): Promise<CrearEmpleadoResult> => {
    const res = await api.post<CrearEmpleadoResult>('/empleados', data)
    return res.data
  },

  listar: async (params?: { q?: string; tipo?: TipoColaborador; page?: number; pageSize?: number }): Promise<ListaEmpleadosResult> => {
    const res = await api.get<ListaEmpleadosResult>('/empleados', { params })
    return res.data
  },

  exportar: (params?: { q?: string; tipo?: TipoColaborador }): void => {
    const base = api.defaults.baseURL ?? ''
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.tipo) qs.set('tipo', params.tipo)
    const token = localStorage.getItem('token') ?? ''
    // Descarga directa vía anchor con Authorization header workaround: usar fetch + blob
    const url = `${base}/empleados/exportar${qs.toString() ? '?' + qs.toString() : ''}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(blob)
        a.download = `empleados-${Date.now()}.csv`
        a.click()
        window.URL.revokeObjectURL(a.href)
      })
  },

  tieneCredenciales: async (): Promise<boolean> => {
    const res = await api.get<{ tiene: boolean }>('/empleados/mis-credenciales/existe')
    return res.data.tiene
  },

  descargarMisCredenciales: async (): Promise<void> => {
    const res = await api.get<Blob>('/empleados/mis-credenciales', { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mis-credenciales.pdf'
    a.click()
    window.URL.revokeObjectURL(url)
  },

  descargarCredencialesEmpleado: async (userId: number, nombre: string): Promise<void> => {
    const res = await api.get<Blob>(`/empleados/${userId}/credenciales`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `credenciales-${nombre.replace(/\s+/g, '-')}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  },

  descargarPlantilla: (): void => {
    const base = api.defaults.baseURL ?? ''
    const token = localStorage.getItem('token') ?? ''
    fetch(`${base}/empleados/plantilla-importar`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(blob)
        a.download = 'plantilla-empleados.csv'
        a.click()
        window.URL.revokeObjectURL(a.href)
      })
  },

  importar: async (archivo: File): Promise<ImportarEmpleadosResult> => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    const res = await api.post<ImportarEmpleadosResult>('/empleados/importar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  darDeBaja: async (userId: number, destinatariosExtra?: string[]): Promise<{ mensaje: string }> => {
    const res = await api.delete<{ mensaje: string }>(`/empleados/${userId}`, {
      data: { destinatariosExtra: destinatariosExtra ?? [] },
    })
    return res.data
  },

  actualizarMiNacionalidad: async (esExtranjero: boolean): Promise<{ esExtranjero: boolean }> => {
    const res = await api.patch<{ esExtranjero: boolean }>('/empleados/mi-extranjero', { esExtranjero })
    return res.data
  },

  actualizarNacionalidad: async (userId: number, esExtranjero: boolean): Promise<{ esExtranjero: boolean }> => {
    const res = await api.patch<{ esExtranjero: boolean }>(`/empleados/${userId}/extranjero`, { esExtranjero })
    return res.data
  },
}

export default empleadosService
