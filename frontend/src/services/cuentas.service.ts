import api from './api';

export type EstadoCuenta = 'ACTIVA' | 'SUSPENDIDA' | 'ELIMINADA';
export type TipoEmpleado = 'DOCENTE' | 'EMPLEADO';

export interface CuentaInstitucional {
  id: number;
  userId: number;
  correoInstitucional: string;
  departamentoId: number;
  estado: EstadoCuenta;
  creadoEn: string;
  actualizadoEn: string;
  user: { id: number; nombre: string; correo: string };
  departamento: { id: number; nombre: string };
  creadoPor?: { id: number; nombre: string };
}

export interface SugerirCorreoDto {
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  tipo: TipoEmpleado;
}

export interface SugerirCorreoResult {
  candidatos: { correo: string; disponible: boolean }[];
}

export interface CrearCuentaDto {
  userId: number;
  departamentoId: number;
  correoInstitucional: string;
  primerNombre: string;
  primerApellido: string;
  tipo: TipoEmpleado;
}

export interface CrearCuentaResult {
  cuenta: CuentaInstitucional;
  passwordTemporal: string;
}

export interface PaginatedCuentas {
  data: CuentaInstitucional[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export const cuentasService = {
  sugerir: async (data: SugerirCorreoDto): Promise<SugerirCorreoResult> => {
    const response = await api.post('/cuentas/sugerir', data);
    return response.data;
  },

  getAll: async (params?: { q?: string; page?: number; pageSize?: number }): Promise<PaginatedCuentas> => {
    const response = await api.get('/cuentas', { params });
    return response.data;
  },

  getById: async (id: number): Promise<CuentaInstitucional> => {
    const response = await api.get(`/cuentas/${id}`);
    return response.data;
  },

  crear: async (data: CrearCuentaDto): Promise<CrearCuentaResult> => {
    const response = await api.post('/cuentas', data);
    return response.data;
  },

  suspender: async (id: number): Promise<CuentaInstitucional> => {
    const response = await api.patch(`/cuentas/${id}/suspender`);
    return response.data;
  },

  activar: async (id: number): Promise<CuentaInstitucional> => {
    const response = await api.patch(`/cuentas/${id}/activar`);
    return response.data;
  },
};
