import api from './api';

export interface Departamento {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  coordinadorId: number | null;
  coordinador: { id: number; nombre: string; correo: string } | null;
}

export interface MiembroDepartamento {
  id: number;
  nombre: string;
  correo: string;
}

export interface CreateDepartamentoDto {
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

export interface UpdateDepartamentoDto {
  nombre?: string;
  descripcion?: string;
  activo?: boolean;
}

export const departamentosService = {
  getAll: async (): Promise<Departamento[]> => {
    const response = await api.get('/departamentos');
    return response.data;
  },

  create: async (data: CreateDepartamentoDto): Promise<Departamento> => {
    const response = await api.post('/departamentos', data);
    return response.data;
  },

  update: async (id: number, data: UpdateDepartamentoDto): Promise<Departamento> => {
    const response = await api.put(`/departamentos/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ mensaje: string }> => {
    const response = await api.delete(`/departamentos/${id}`);
    return response.data;
  },

  asignarCoordinador: async (id: number, userId: number): Promise<Departamento> => {
    const response = await api.put(`/departamentos/${id}/coordinador`, { userId });
    return response.data;
  },

  quitarCoordinador: async (id: number): Promise<Departamento> => {
    const response = await api.delete(`/departamentos/${id}/coordinador`);
    return response.data;
  },

  getMiembros: async (id: number): Promise<MiembroDepartamento[]> => {
    const response = await api.get(`/departamentos/${id}/miembros`);
    return response.data;
  },
};
