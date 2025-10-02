
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';

// Páginas
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Usuarios } from './pages/Usuarios';
import { Areas } from './pages/Areas';
import { Docentes } from './pages/Docentes';

// Crear cliente de consulta
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Componente para rutas protegidas
const ProtectedRoute = ({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) => {
  const { isAuthenticated, isLoading, hasRole, user } = useAuth();
  
  console.log('ProtectedRoute - Estado de autenticación:', { isAuthenticated, isLoading, user });

  if (isLoading) {
    console.log('ProtectedRoute - Cargando...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute - No autenticado, redirigiendo a login');
    return <Navigate to="/login" />;
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    console.log('ProtectedRoute - No tiene los roles requeridos:', requiredRoles);
    return <Navigate to="/" />;
  }

  console.log('ProtectedRoute - Acceso permitido');
  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/areas"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'RH']}>
                  <Areas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/docentes"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'RH', 'COORD']}>
                  <Docentes />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App
