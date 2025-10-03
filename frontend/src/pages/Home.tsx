import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useArea } from '../context/AreaContext';
import { MainLayout } from '../layouts/MainLayout';
import { FaUsers, FaBuilding, FaUserTie, FaCalendarAlt } from 'react-icons/fa';
import { AreaSelector } from '../components/AreaSelector';
import { useQuery } from '@tanstack/react-query';
import { periodosService } from '../services/periodos.service';

export const Home = () => {
  const { user, hasRole } = useAuth();
  const { selectedArea } = useArea();
  const navigate = useNavigate();
  
  // Query para obtener el periodo activo
  const { data: activePeriodo, isLoading: isLoadingPeriodo } = useQuery({
    queryKey: ['activePeriodo'],
    queryFn: periodosService.getActivePeriodo
  });

  const cards = [
    {
      title: 'Usuarios',
      description: 'Gestión de usuarios y roles del sistema',
      icon: <FaUsers className="h-10 w-10 text-primary" />,
      path: '/usuarios',
      roles: ['ADMIN'],
    },
    {
      title: 'Áreas',
      description: 'Gestión de áreas académicas y asignación de coordinadores',
      icon: <FaBuilding className="h-10 w-10 text-primary" />,
      path: '/areas',
      roles: ['ADMIN', 'RH'],
    },
    {
      title: 'Docentes',
      description: 'Gestión de docentes e importación masiva',
      icon: <FaUserTie className="h-10 w-10 text-primary" />,
      path: '/docentes',
      roles: ['ADMIN', 'RH', 'COORD'],
    },
    {
      title: 'Periodos',
      description: 'Gestión de periodos académicos',
      icon: <FaCalendarAlt className="h-10 w-10 text-primary" />,
      path: '/periodos',
      roles: ['ADMIN', 'RH'],
    },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Sistema de Recursos Humanos</h1>
          <p className="text-gray-600 mt-2">
            Bienvenido, {user?.nombre}. {hasRole('COORD') && selectedArea && `Área seleccionada: ${selectedArea.nombre}`}
          </p>
        </div>
        
        {/* Mostrar selector de área para usuarios COORD en la página de inicio */}
        {hasRole('COORD') && (
          <div className="space-y-6">
            {/* Selector de Área */}
            <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Selector de Área</h2>
              <p className="text-gray-600 mb-4">Selecciona el área con la que deseas trabajar:</p>
              <AreaSelector />
              
              {selectedArea && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="font-medium text-blue-800">Área actual: {selectedArea.nombre}</p>
                  <p className="text-sm text-blue-600 mt-1">Todas las operaciones que realices se aplicarán a esta área.</p>
                </div>
              )}
            </div>
            
            {/* Periodo Activo */}
            <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Periodo Activo</h2>
              
              {isLoadingPeriodo ? (
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : activePeriodo ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="font-medium text-green-800">Periodo: {activePeriodo.nombre}</p>
                  <p className="text-sm text-green-600 mt-1">
                    Del {new Date(activePeriodo.fechaInicio).toLocaleDateString('es-ES')} al {new Date(activePeriodo.fechaFin).toLocaleDateString('es-ES')}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="font-medium text-yellow-800">No hay periodo activo</p>
                  <p className="text-sm text-yellow-600 mt-1">Contacta al administrador para abrir un periodo.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards
            .filter((card) => hasRole(card.roles))
            .map((card, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(card.path)}
              >
                <div className="p-6">
                  <div className="flex justify-center mb-4">{card.icon}</div>
                  <h2 className="text-xl font-semibold text-center text-gray-800">
                    {card.title}
                  </h2>
                  <p className="mt-2 text-center text-gray-600">
                    {card.description}
                  </p>
                </div>
                <div className="px-6 py-2 bg-gray-50 border-t border-gray-100">
                  <p className="text-center text-sm text-primary font-medium">
                    Acceder
                  </p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </MainLayout>
  );
};
