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

  // Formatear fechas extrayendo solo la parte de la fecha (YYYY-MM-DD)
  const formatFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="flex items-center px-3 py-2 text-sm text-white bg-green-600 rounded-md mt-2">
      <FaCalendarAlt className="mr-2" />
      <div>
        <span className="font-medium text-lg">{activePeriodo.nombre}</span>
        <span className="ml-2 text-xs">
          {formatFecha(activePeriodo.fechaInicio)} - {formatFecha(activePeriodo.fechaFin)}
        </span>
      </div>
    </div>
  );
};
