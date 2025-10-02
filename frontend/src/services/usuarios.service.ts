import api from './api';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  activo: boolean;
  roles: string[];
  createdAt: string;
}

export interface CreateUsuarioDto {
  nombre: string;
  correo: string;
  password: string;
  roles: string[];
  activo?: boolean;
}

export interface UpdateUsuarioDto {
  nombre?: string;
  roles?: string[];
  activo?: boolean;
}

export const usuariosService = {
  getAll: async (): Promise<Usuario[]> => {
    const response = await api.get('/usuarios');
    return response.data;
  },

  getById: async (id: number): Promise<Usuario> => {
    const response = await api.get(`/usuarios/${id}`);
    return response.data;
  },

  create: async (usuario: CreateUsuarioDto): Promise<Usuario> => {
    const response = await api.post('/usuarios', usuario);
    return response.data;
  },

  update: async (id: number, usuario: UpdateUsuarioDto): Promise<Usuario> => {
    const response = await api.put(`/usuarios/${id}`, usuario);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/usuarios/${id}`);
  },

  getRoles: async (): Promise<{ id: number; nombre: string }[]> => {
    const response = await api.get('/usuarios/roles');
    return response.data;
  },
};
