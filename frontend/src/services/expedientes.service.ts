import api, { SERVER_BASE_URL } from './api'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface TipoDocumento {
  id: number
  nombre: string
  descripcion: string | null
  seccion: string | null
  requerido: boolean
  requiereVigencia: boolean
  activo: boolean
  orden: number
}

export type EstadoDocumento = 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO' | 'PROXIMO_A_VENCER' | 'VENCIDO'

export interface DocumentoExpediente {
  id: number
  empleadoId: number
  tipoDocumentoId: number
  archivo: string
  nombreOriginal: string
  estado: EstadoDocumento
  fechaVigencia: string | null
  soloMesAnio: boolean
  motivoRechazo: string | null
  verificadoPorId: number | null
  verificadoEn: string | null
  archivoAnterior: string | null
  nombreOriginalAnterior: string | null
  fechaVigenciaAnterior: string | null
  reemplazadoEn: string | null
  createdAt: string
  updatedAt: string
  tipo?: TipoDocumento
}

export interface ItemExpediente {
  tipo: TipoDocumento
  documento: DocumentoExpediente | null
}

export interface MiExpedienteResponse {
  items: ItemExpediente[]
  completo: boolean
}

export interface EmpleadoExpediente {
  id: number
  nombre: string
  correo: string
  totalDocumentos: number
  verificados: number
  totalRequeridos: number
  completo: boolean
}

export interface ExpedienteEmpleadoResponse {
  empleado: { id: number; nombre: string; correo: string }
  items: ItemExpediente[]
  completo: boolean
}

export interface CreateTipoDto {
  nombre: string
  descripcion?: string
  seccion?: string | null
  requerido: boolean
  requiereVigencia: boolean
  orden?: number
}

export interface UpdateTipoDto extends Partial<CreateTipoDto> {
  activo?: boolean
}

export interface SeccionExpediente {
  id: number
  nombre: string
  orden: number
  activo: boolean
}

export interface CreateSeccionDto {
  nombre: string
  orden?: number
}

// ── Servicio ─────────────────────────────────────────────────────────────────

export const expedientesService = {
  // ADMIN: Tipos de documento
  getTipos: async (): Promise<TipoDocumento[]> => {
    const { data } = await api.get('/expedientes/tipos')
    return data
  },

  crearTipo: async (dto: CreateTipoDto): Promise<TipoDocumento> => {
    const { data } = await api.post('/expedientes/tipos', dto)
    return data
  },

  actualizarTipo: async (id: number, dto: UpdateTipoDto): Promise<TipoDocumento> => {
    const { data } = await api.put(`/expedientes/tipos/${id}`, dto)
    return data
  },

  eliminarTipo: async (id: number): Promise<void> => {
    await api.delete(`/expedientes/tipos/${id}`)
  },

  // EMPLEADO: Mi expediente
  getMiExpediente: async (): Promise<MiExpedienteResponse> => {
    const { data } = await api.get('/expedientes/mi-expediente')
    return data
  },

  subirDocumento: async (
    tipoDocumentoId: number,
    archivo: File,
    fechaVigencia?: string,
    soloMesAnio?: boolean
  ): Promise<DocumentoExpediente> => {
    const formData = new FormData()
    formData.append('tipoDocumentoId', String(tipoDocumentoId))
    formData.append('archivo', archivo)
    if (fechaVigencia) formData.append('fechaVigencia', fechaVigencia)
    if (soloMesAnio !== undefined) formData.append('soloMesAnio', String(soloMesAnio))

    const { data } = await api.post('/expedientes/documentos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  // RH / ADMIN: Validación
  listarExpedientes: async (): Promise<EmpleadoExpediente[]> => {
    const { data } = await api.get('/expedientes')
    return data
  },

  getExpedienteEmpleado: async (empleadoId: number): Promise<ExpedienteEmpleadoResponse> => {
    const { data } = await api.get(`/expedientes/${empleadoId}`)
    return data
  },

  verificarDocumento: async (
    docId: number,
    accion: 'VERIFICADO' | 'RECHAZADO',
    motivoRechazo?: string
  ): Promise<DocumentoExpediente> => {
    const { data } = await api.patch(`/expedientes/documentos/${docId}/verificar`, {
      accion,
      motivoRechazo,
    })
    return data
  },

  // Util: URL del archivo en el servidor
  getArchivoUrl: (ruta: string) => `${SERVER_BASE_URL}/${ruta}`,

  // ADMIN: Secciones
  getSecciones: async (): Promise<SeccionExpediente[]> => {
    const { data } = await api.get('/expedientes/secciones')
    return data
  },

  crearSeccion: async (dto: CreateSeccionDto): Promise<SeccionExpediente> => {
    const { data } = await api.post('/expedientes/secciones', dto)
    return data
  },

  actualizarSeccion: async (id: number, dto: Partial<CreateSeccionDto> & { activo?: boolean }): Promise<SeccionExpediente> => {
    const { data } = await api.put(`/expedientes/secciones/${id}`, dto)
    return data
  },

  eliminarSeccion: async (id: number): Promise<void> => {
    await api.delete(`/expedientes/secciones/${id}`)
  },
}
