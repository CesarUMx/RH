import api from './api';

export type EstadoAlta = 'PENDIENTE' | 'COMPLETO' | 'RECHAZADO';

export const ESTADO_ALTA = {
  PENDIENTE: 'PENDIENTE' as EstadoAlta,
  COMPLETO: 'COMPLETO' as EstadoAlta,
  RECHAZADO: 'RECHAZADO' as EstadoAlta
};

export interface SolicitudDocumentos {
  constanciaFiscal?: string | null;
  comprobanteDomicilio?: string | null;
  cv?: string | null;
  cuentaBancaria?: string | null;
  ine?: string | null;
}

export interface SolicitudAlta {
  id: number;
  nombre: string;
  estadoAlta: EstadoAlta;
  motivoRechazo?: string;
  documentos?: SolicitudDocumentos;
  createdAt: string;
  updatedAt?: string;
}

export interface CrearSolicitudAltaDto {
  nombre: string;
}

export interface SolicitudesPaginadas {
  data: SolicitudAlta[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export const solicitudesService = {
  // Crear una nueva solicitud de alta
  crearSolicitudAlta: async (datos: CrearSolicitudAltaDto): Promise<SolicitudAlta> => {
    try {
      const response = await api.post('/solicitudes/alta', datos);
      return response.data;
    } catch (error) {
      console.error('Error al crear solicitud de alta:', error);
      throw error;
    }
  },
  
  // Subir documento para una solicitud
  subirDocumentoSolicitud: async (solicitudId: number, tipo: string, archivo: File): Promise<SolicitudAlta> => {
    try {
      const formData = new FormData();
      formData.append('tipo', tipo);
      formData.append('documento', archivo);
      
      const response = await api.post(`/solicitudes/alta/${solicitudId}/documentos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error al subir documento ${tipo}:`, error);
      throw error;
    }
  },
  
  // Obtener solicitudes pendientes (mantenido por compatibilidad)
  getSolicitudesPendientes: async (page = 1, pageSize = 10): Promise<SolicitudesPaginadas> => {
    try {
      const response = await api.get('/solicitudes/pendientes', {
        params: { page, pageSize }
      });
      return response.data;
    } catch (error) {
      console.error('Error al obtener solicitudes pendientes:', error);
      throw error;
    }
  },
  
  // Obtener solicitudes filtradas por estado
  getSolicitudesFiltradas: async (estado: EstadoAlta | 'TODOS' = 'PENDIENTE', page = 1, pageSize = 10): Promise<SolicitudesPaginadas> => {
    try {
      const params: Record<string, any> = { page, pageSize };
      
      // Solo agregar el filtro de estado si no es 'TODOS'
      if (estado !== 'TODOS') {
        params.estado = estado;
      }
      
      const response = await api.get('/solicitudes', { params });
      return response.data;
    } catch (error) {
      console.error('Error al obtener solicitudes filtradas:', error);
      throw error;
    }
  },
  
  // Actualizar estado de una solicitud
  actualizarEstadoSolicitud: async (solicitudId: number, estado: EstadoAlta, motivoRechazo?: string): Promise<SolicitudAlta> => {
    try {
      const data: { estado: EstadoAlta; motivoRechazo?: string } = { estado };
      
      // Si es rechazo, incluir motivo
      if (estado === ESTADO_ALTA.RECHAZADO && motivoRechazo) {
        data.motivoRechazo = motivoRechazo;
      }
      
      const response = await api.patch(`/solicitudes/alta/${solicitudId}/estado`, data);
      return response.data;
    } catch (error) {
      console.error('Error al actualizar estado de solicitud:', error);
      throw error;
    }
  }
};
