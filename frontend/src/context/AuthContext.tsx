import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/auth.service';

interface User {
  id: number;
  nombre: string;
  correo: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (correo: string, password: string) => Promise<any>; // Cambiado a Promise<any>
  logout: () => void;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      console.log('AuthContext - initAuth - token:', token ? 'Existe token' : 'No hay token');
      if (token) {
        try {
          console.log('AuthContext - Intentando obtener datos del usuario con token');
          const userData = await authService.me();
          console.log('AuthContext - Datos del usuario obtenidos:', userData);
          setUser(userData.user);
        } catch (error) {
          console.error('AuthContext - Error al obtener datos del usuario:', error);
          logout();
        }
      } else {
        console.log('AuthContext - No hay token, no se intenta obtener datos del usuario');
      }
      setIsLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (correo: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('AuthContext - login - Iniciando sesión...');
      const response = await authService.login({ correo, password });
      console.log('AuthContext - login - Respuesta:', response);
      
      // Guardar token y datos de usuario en localStorage
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      console.log('AuthContext - login - Token guardado en localStorage');
      
      // Actualizar estado
      setToken(response.token);
      setUser(response.user);
      console.log('AuthContext - login - Estado actualizado:', { token: response.token, user: response.user });
      
      // Verificar inmediatamente si el usuario está autenticado
      console.log('AuthContext - login - isAuthenticated:', !!response.user);
      
      return response; // Devolver la respuesta para uso posterior
    } catch (error) {
      console.error('AuthContext - Error al iniciar sesión:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
  };

  const hasRole = (role: string | string[]) => {
    if (!user) return false;
    
    if (Array.isArray(role)) {
      return role.some(r => user.roles.includes(r));
    }
    
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
