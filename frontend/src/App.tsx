
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import { AreaProvider } from './context/AreaContext';

// Páginas
import { Login } from './pages/Login';
import { Usuarios } from './pages/Usuarios';
import { Areas } from './pages/Areas';
import { Docentes } from './pages/Docentes';
import { Periodos } from './pages/Periodos';
import { CargaHoras } from './pages/CargaHoras';
import { GestionPagos } from './pages/GestionPagos';

// Componentes
import { RedireccionInicio } from './components/RedireccionInicio';

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AreaProvider>
          <Router>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RedireccionInicio />
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
            <Route
              path="/periodos"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'RH']}>
                  <Periodos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/carga-horas"
              element={
                <ProtectedRoute requiredRoles={['COORD']}>
                  <CargaHoras />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestion-pagos"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'RH']}>
                  <GestionPagos />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
        <Toaster position="top-right" />
        </AreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App
