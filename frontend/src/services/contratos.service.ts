import api, { SERVER_BASE_URL } from './api'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface Contrato {
  id: number
  empleadoId: number
  titulo: string
  archivo: string
  nombreOriginal: string
  subidoPorId: number
  createdAt: string
  empleado?: { id: number; nombre: string; correo: string }
}

export interface SubirContratoDto {
  empleadoId: number
  titulo: string
  archivo: File
}

// ── Servicio ─────────────────────────────────────────────────────────────────

export const contratosService = {
  // RH / ADMIN
  subirContrato: async (dto: SubirContratoDto): Promise<Contrato> => {
    const formData = new FormData()
    formData.append('empleadoId', String(dto.empleadoId))
    formData.append('titulo', dto.titulo)
    formData.append('archivo', dto.archivo)

    const { data } = await api.post('/contratos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  listarContratos: async (empleadoId?: number): Promise<Contrato[]> => {
    const params = empleadoId ? { empleadoId } : {}
    const { data } = await api.get('/contratos', { params })
    return data
  },

  eliminarContrato: async (id: number): Promise<void> => {
    await api.delete(`/contratos/${id}`)
  },

  // EMPLEADO
  misContratos: async (): Promise<Contrato[]> => {
    const { data } = await api.get('/contratos/mis-contratos')
    return data
  },

  descargarContrato: async (id: number, nombreOriginal: string): Promise<void> => {
    const response = await api.get(`/contratos/${id}/descargar`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', nombreOriginal)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  getArchivoUrl: (ruta: string) => `${SERVER_BASE_URL}/${ruta}`,
}
