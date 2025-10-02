import api from './api';
import type { Usuario } from './usuarios.service';

export interface Area {
  id: number;
  nombre: string;
  activo: boolean;
  coordinadores: {
    id: number;
    nombre: string;
    correo: string;
  }[];
}

export interface CreateAreaDto {
  nombre: string;
  activo?: boolean;
}

export interface UpdateAreaDto {
  nombre?: string;
  activo?: boolean;
}

export const areasService = {
  getAll: async (): Promise<Area[]> => {
    const response = await api.get('/areas');
    return response.data;
  },

  getById: async (id: number): Promise<Area> => {
    const response = await api.get(`/areas/${id}`);
    return response.data;
  },

  create: async (area: CreateAreaDto): Promise<Area> => {
    const response = await api.post('/areas', area);
    return response.data;
  },

  update: async (id: number, area: UpdateAreaDto): Promise<Area> => {
    const response = await api.put(`/areas/${id}`, area);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/areas/${id}`);
  },

  getCoordinadores: async (id: number): Promise<Usuario[]> => {
    const response = await api.get(`/areas/${id}/coordinadores`);
    return response.data;
  },

  asignarCoordinador: async (areaId: number, userId: number): Promise<void> => {
    await api.post(`/areas/${areaId}/coordinadores`, { userId });
  },

  eliminarCoordinador: async (areaId: number, userId: number): Promise<void> => {
    await api.delete(`/areas/${areaId}/coordinadores/${userId}`);
  },
};
