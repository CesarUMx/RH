import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUsers, FaBuilding, FaUserTie, FaBars, FaTimes, FaSignOutAlt, FaUser, FaCalendarAlt, FaHome } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { AreaSelector } from '../components/AreaSelector';

interface MainLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: ReactNode;
  roles: string[];
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      name: 'Inicio',
      path: '/',
      icon: <FaHome className="mr-3 h-5 w-5" />,
      roles: ['ADMIN', 'RH', 'COORD'],
    },
    {
      name: 'Usuarios',
      path: '/usuarios',
      icon: <FaUsers className="mr-3 h-5 w-5" />,
      roles: ['ADMIN'],
    },
    {
      name: 'Áreas',
      path: '/areas',
      icon: <FaBuilding className="mr-3 h-5 w-5" />,
      roles: ['ADMIN', 'RH'],
    },
    {
      name: 'Docentes',
      path: '/docentes',
      icon: <FaUserTie className="mr-3 h-5 w-5" />,
      roles: ['ADMIN', 'RH', 'COORD'],
    },
    {
      name: 'Periodos',
      path: '/periodos',
      icon: <FaCalendarAlt className="mr-3 h-5 w-5" />,
      roles: ['ADMIN', 'RH'],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar para desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-primary">
          <div className="flex items-center flex-shrink-0 px-4">
            <img
              className="h-8 w-auto"
              src="/logo.svg"
              alt="Logo UMx"
            />
            <h1 className="ml-3 text-xl font-bold text-white">UMx RH</h1>
          </div>
          <div className="mt-8 flex-1 flex flex-col">
            {/* Área Selector para usuarios COORD */}
            {hasRole('COORD') && (
              <div className="px-2 mb-4">
                <AreaSelector />
              </div>
            )}
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navItems.map((item) => {
                // Solo mostrar items para los que el usuario tiene permisos
                if (!hasRole(item.roles)) return null;

                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      isActive
                        ? 'bg-secondary text-white border-l-4 border-white pl-1'
                        : 'text-white hover:bg-primary-light'
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="p-4 border-t border-primary-dark">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FaUser className="h-8 w-8 rounded-full bg-primary-light p-1 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{user?.nombre}</p>
                <p className="text-xs text-gray-300 truncate">{user?.correo}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex items-center w-full px-2 py-2 text-sm font-medium text-white rounded-md hover:bg-primary-light"
            >
              <FaSignOutAlt className="mr-3 h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-primary shadow-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img
              className="h-8 w-auto"
              src="/logo.svg"
              alt="Logo UMx"
            />
            <h1 className="ml-3 text-xl font-bold text-white">UMx RH</h1>
          </div>
          <button
            onClick={toggleMobileMenu}
            className="text-white focus:outline-none"
          >
            {isMobileMenuOpen ? (
              <FaTimes className="h-6 w-6" />
            ) : (
              <FaBars className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black opacity-25" onClick={toggleMobileMenu}></div>
          <div className="relative flex flex-col w-72 max-w-sm py-6 px-6 bg-primary h-full overflow-y-auto">
            <div className="flex items-center mb-8">
              <img
                className="h-8 w-auto"
                src="/logo.svg"
                alt="Logo UMx"
              />
              <h1 className="ml-3 text-xl font-bold text-white">UMx RH</h1>
            </div>
            {/* Área Selector para usuarios COORD en mobile */}
            {hasRole('COORD') && (
              <div className="mb-4">
                <AreaSelector />
              </div>
            )}
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                if (!hasRole(item.roles)) return null;
                
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center px-2 py-3 text-base font-medium rounded-md transition-all duration-200 ${
                      isActive
                        ? 'bg-secondary text-white border-l-4 border-white pl-1'
                        : 'text-white hover:bg-primary-light'
                    }`}
                    onClick={toggleMobileMenu}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-primary-dark mt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FaUser className="h-8 w-8 rounded-full bg-primary-light p-1 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{user?.nombre}</p>
                  <p className="text-xs text-gray-300 truncate">{user?.correo}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  toggleMobileMenu();
                }}
                className="mt-3 flex items-center w-full px-2 py-2 text-base font-medium text-white rounded-md hover:bg-primary-light"
              >
                <FaSignOutAlt className="mr-3 h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none pt-16 md:pt-0">
          <div className="py-6 px-4 sm:px-6 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
};
