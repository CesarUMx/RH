import api from './api';

// Enum para estados de baja
export type EstadoBaja = 'PENDIENTE' | 'PROCESADO' | 'CANCELADO';

export const EstadoBajaValues = {
  PENDIENTE: 'PENDIENTE' as EstadoBaja,
  PROCESADO: 'PROCESADO' as EstadoBaja,
  CANCELADO: 'CANCELADO' as EstadoBaja
};

// Interfaces
export interface SolicitudBaja {
  id: number;
  docenteId: number;
  motivoBaja: string;
  estadoBaja: EstadoBaja;
  creadorId: number;
  createdAt: string;
  updatedAt?: string;
  docente: {
    id: number;
    nombre: string;
    codigoInterno: string;
    rfc: string;
  };
  creador: {
    id: number;
    nombre: string;
    correo: string;
  };
}

export interface CrearSolicitudBajaDto {
  docenteId: number;
  motivoBaja: string;
}

export interface ActualizarEstadoSolicitudBajaDto {
  estado: EstadoBaja;
}

// Servicio para manejar solicitudes de baja
export const solicitudesBajaService = {
  // Crear una nueva solicitud de baja
  crearSolicitudBaja: async (data: CrearSolicitudBajaDto): Promise<SolicitudBaja> => {
    const response = await api.post('/solicitudes/baja', data);
    return response.data;
  },

  // Obtener todas las solicitudes de baja con filtro opcional por estado
  getSolicitudesBaja: async (estado?: EstadoBaja): Promise<SolicitudBaja[]> => {
    const params = estado ? { estado } : {};
    const response = await api.get('/solicitudes/baja', { params });
    return response.data;
  },

  // Actualizar el estado de una solicitud de baja
  actualizarEstadoSolicitudBaja: async (id: number, data: ActualizarEstadoSolicitudBajaDto): Promise<SolicitudBaja> => {
    const response = await api.patch(`/solicitudes/baja/${id}/estado`, data);
    return response.data;
  }
};
