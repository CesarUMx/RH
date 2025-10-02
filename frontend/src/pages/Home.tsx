import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../layouts/MainLayout';
import { FaUsers, FaBuilding, FaUserTie } from 'react-icons/fa';

export const Home = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirigir automáticamente a la sección correspondiente según el rol
    if (hasRole('ADMIN')) {
      navigate('/usuarios');
    } else if (hasRole(['RH', 'COORD'])) {
      navigate('/docentes');
    }
  }, [hasRole, navigate]);

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
  ];

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Sistema de Recursos Humanos</h1>
          <p className="text-gray-600 mt-2">
            Bienvenido, {user?.nombre}. Selecciona una opción para comenzar.
          </p>
        </div>

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
