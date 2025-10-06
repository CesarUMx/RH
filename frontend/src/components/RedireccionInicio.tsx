import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RedireccionInicio = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirigir según el rol del usuario
    if (hasRole(['ADMIN'])) {
      navigate('/usuarios');
    } else if (hasRole(['RH'])) {
      navigate('/docentes');
    } else if (hasRole(['COORD'])) {
      navigate('/carga-horas');
    } else {
      // Si no tiene ningún rol específico, redirigir a docentes por defecto
      navigate('/docentes');
    }
  }, [hasRole, navigate]);

  // Mostrar un spinner mientras se redirige
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
};
