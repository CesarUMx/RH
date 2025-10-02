import api from './api';

interface LoginCredentials {
  correo: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: number;
    nombre: string;
    correo: string;
    roles: string[];
  };
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  me: async () => {
    try {
      console.log('Obteniendo datos del usuario...');
      // La ruta debe ser /api/me, pero como baseURL ya incluye /api, usamos solo /me
      const response = await api.get('/me');
      console.log('Respuesta:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};
