import { useQuery } from '@tanstack/react-query';
import { periodosService } from '../services/periodos.service';
import { FaCalendarAlt } from 'react-icons/fa';

export const PeriodoInfo = () => {
  // Query para obtener el periodo activo
  const { data: activePeriodo, isLoading } = useQuery({
    queryKey: ['activePeriodo'],
    queryFn: periodosService.getActivePeriodo
  });

  if (isLoading) {
    return (
      <div className="flex items-center px-3 py-2 text-sm text-white bg-primary-light rounded-md mt-2">
        <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
        <span>Cargando periodo...</span>
      </div>
    );
  }

  if (!activePeriodo) {
    return (
      <div className="flex items-center px-3 py-2 text-sm text-white bg-yellow-600 rounded-md mt-2">
        <FaCalendarAlt className="mr-2" />
        <span className='text-lg'>No hay periodo activo</span>
      </div>
    );
  }

  return (
    <div className="flex items-center px-3 py-2 text-sm text-white bg-green-600 rounded-md mt-2">
      <FaCalendarAlt className="mr-2" />
      <div>
        <span className="font-medium text-lg">{activePeriodo.nombre}</span>
        <span className="ml-2 text-xs">
          {new Date(activePeriodo.fechaInicio).toLocaleDateString('es-ES')} - {new Date(activePeriodo.fechaFin).toLocaleDateString('es-ES')}
        </span>
      </div>
    </div>
  );
};
