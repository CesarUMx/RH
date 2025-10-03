import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { areasService, type Area } from '../services/areas.service';

interface AreaContextType {
  areas: Area[];
  selectedArea: Area | null;
  isLoading: boolean;
  error: string | null;
  setSelectedArea: (area: Area) => void;
  fetchAreas: () => Promise<void>;
}

const AreaContext = createContext<AreaContextType | undefined>(undefined);

export const AreaProvider = ({ children }: { children: ReactNode }) => {
  const { token, hasRole } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para obtener las áreas asignadas al usuario
  const fetchAreas = async () => {
    console.log('fetchAreas - Iniciando...', { token, isCoord: hasRole('COORD') });
    if (!token || !hasRole('COORD')) {
      console.log('fetchAreas - No se cumplen las condiciones', { token: !!token, isCoord: hasRole('COORD') });
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log('fetchAreas - Obteniendo áreas...');

    try {
      const areasData = await areasService.getMisAreas();
      console.log('fetchAreas - Áreas obtenidas:', areasData);

      setAreas(areasData);
      
      if (areasData.length > 0) {
        // Verificar si el área seleccionada actual está en la lista de áreas disponibles
        const isCurrentAreaValid = selectedArea && areasData.some(area => area.id === selectedArea.id);
        
        if (!isCurrentAreaValid) {
          // Intentar recuperar el área seleccionada del localStorage
          const savedAreaId = localStorage.getItem('selectedAreaId');
          
          if (savedAreaId) {
            const savedArea = areasData.find((area) => area.id === parseInt(savedAreaId));
            if (savedArea) {
              setSelectedArea(savedArea);
            } else {
              // Si el área guardada no está en las áreas disponibles, seleccionar la primera
              setSelectedArea(areasData[0]);
              localStorage.setItem('selectedAreaId', areasData[0].id.toString());
            }
          } else {
            // Si no hay área guardada, seleccionar la primera
            setSelectedArea(areasData[0]);
            localStorage.setItem('selectedAreaId', areasData[0].id.toString());
          }
        }
      } else if (selectedArea) {
        // Si no hay áreas disponibles pero hay un área seleccionada, limpiarla
        setSelectedArea(null);
        localStorage.removeItem('selectedAreaId');
      }
    } catch (err) {
      console.error('Error al obtener áreas:', err);
      setError('Error al cargar las áreas asignadas');
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto para cargar áreas cuando el componente se monta o cambia el rol
  useEffect(() => {
    if (token && hasRole('COORD')) {
      console.log('AreaContext - useEffect - Cargando áreas para COORD');
      fetchAreas();
    }
  }, [token, hasRole]);

  // Función para cambiar el área seleccionada
  const handleSetSelectedArea = (area: Area) => {
    setSelectedArea(area);
    localStorage.setItem('selectedAreaId', area.id.toString());
  };

  return (
    <AreaContext.Provider
      value={{
        areas,
        selectedArea,
        isLoading,
        error,
        setSelectedArea: handleSetSelectedArea,
        fetchAreas
      }}
    >
      {children}
    </AreaContext.Provider>
  );
};

export const useArea = () => {
  const context = useContext(AreaContext);
  if (context === undefined) {
    throw new Error('useArea debe ser usado dentro de un AreaProvider');
  }
  return context;
};
