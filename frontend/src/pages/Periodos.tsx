import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaPlus, FaCheck, FaLock, FaFileAlt } from 'react-icons/fa';
import { createColumnHelper } from '@tanstack/react-table';

import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

import { periodosService, EstadoPeriodo } from '../services/periodos.service';
import type { Periodo } from '../services/periodos.service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';

// Esquema de validación para crear periodo
const createPeriodoSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  fechaInicio: z.string().refine(value => !isNaN(Date.parse(value)), {
    message: 'Fecha de inicio inválida',
  }),
  fechaFin: z.string().refine(value => !isNaN(Date.parse(value)), {
    message: 'Fecha de fin inválida',
  }),
}).refine(data => {
  const inicio = new Date(data.fechaInicio);
  const fin = new Date(data.fechaFin);
  return inicio <= fin;
}, {
  message: 'La fecha de inicio debe ser menor o igual a la fecha de fin',
  path: ['fechaFin'],
});

type CreatePeriodoForm = z.infer<typeof createPeriodoSchema>;

export const Periodos = () => {
  const { hasRole } = useAuth();
  const esRH = hasRole(['ADMIN', 'RH']);
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPeriodo, setSelectedPeriodo] = useState<Periodo | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [accionConfirmacion, setAccionConfirmacion] = useState<'abrir' | 'cerrar' | 'reportar'>('abrir');

  // Consulta para obtener periodos
  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ['periodos'],
    queryFn: periodosService.getAll,
  });

  // Mutación para crear periodo
  const createPeriodoMutation = useMutation({
    mutationFn: periodosService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
      setIsCreateModalOpen(false);
      createForm.reset();
      toast.success('Periodo creado correctamente');
    },
    onError: (error) => {
      console.error('Error al crear periodo:', error);
      toast.error('Error al crear periodo');
    },
  });

  // Mutación para abrir periodo
  const abrirPeriodoMutation = useMutation({
    mutationFn: periodosService.abrir,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
      setIsConfirmModalOpen(false);
      toast.success('Periodo abierto correctamente');
    },
    onError: (error: any) => {
      console.error('Error al abrir periodo:', error);
      // Si hay un periodo abierto, mostrar mensaje específico
      if (error.response?.data?.periodoAbierto) {
        toast.error(`Ya existe un periodo abierto: ${error.response.data.periodoAbierto.nombre}`);
      } else {
        toast.error('Error al abrir periodo');
      }
    },
  });

  // Mutación para cerrar periodo
  const cerrarPeriodoMutation = useMutation({
    mutationFn: periodosService.cerrar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
      setIsConfirmModalOpen(false);
      toast.success('Periodo cerrado correctamente');
    },
    onError: (error) => {
      console.error('Error al cerrar periodo:', error);
      toast.error('Error al cerrar periodo');
    },
  });

  // Mutación para reportar periodo
  const reportarPeriodoMutation = useMutation({
    mutationFn: periodosService.reportar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
      setIsConfirmModalOpen(false);
      toast.success('Periodo reportado correctamente');
    },
    onError: (error) => {
      console.error('Error al reportar periodo:', error);
      toast.error('Error al reportar periodo');
    },
  });

  // Formulario para crear periodo
  const createForm = useForm({
    resolver: zodResolver(createPeriodoSchema),
    defaultValues: {
      nombre: '',
      fechaInicio: '',
      fechaFin: '',
    },
  });

  // Función para manejar la creación de periodo
  const handleCreateSubmit = (data: CreatePeriodoForm) => {
    createPeriodoMutation.mutate(data);
  };

  // Función para abrir modal de confirmación
  const handleConfirmAction = (periodo: Periodo, accion: 'abrir' | 'cerrar' | 'reportar') => {
    setSelectedPeriodo(periodo);
    setAccionConfirmacion(accion);
    setIsConfirmModalOpen(true);
  };

  // Función para ejecutar la acción confirmada
  const handleConfirmExecute = () => {
    if (!selectedPeriodo) return;

    switch (accionConfirmacion) {
      case 'abrir':
        abrirPeriodoMutation.mutate(selectedPeriodo.id);
        break;
      case 'cerrar':
        cerrarPeriodoMutation.mutate(selectedPeriodo.id);
        break;
      case 'reportar':
        reportarPeriodoMutation.mutate(selectedPeriodo.id);
        break;
    }
  };

  // Obtener el texto y color según el estado del periodo
  const getEstadoInfo = (estado: EstadoPeriodo) => {
    switch (estado) {
      case EstadoPeriodo.BORRADOR:
        return { text: 'Borrador', color: 'bg-gray-200 text-gray-800' };
      case EstadoPeriodo.ABIERTO:
        return { text: 'Abierto', color: 'bg-green-200 text-green-800' };
      case EstadoPeriodo.CERRADO:
        return { text: 'Cerrado', color: 'bg-yellow-200 text-yellow-800' };
      case EstadoPeriodo.REPORTADO:
        return { text: 'Reportado', color: 'bg-blue-200 text-blue-800' };
      default:
        return { text: estado, color: 'bg-gray-200 text-gray-800' };
    }
  };

  // Configuración de columnas para la tabla
  const columnHelper = createColumnHelper<Periodo>();
  const columns: any[] = [
    columnHelper.accessor('nombre', {
      header: 'Nombre',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('fechaInicio', {
      header: 'Fecha de inicio',
      cell: (info) => new Date(info.getValue()).toLocaleDateString('es-ES'),
    }),
    columnHelper.accessor('fechaFin', {
      header: 'Fecha de fin',
      cell: (info) => new Date(info.getValue()).toLocaleDateString('es-ES'),
    }),
    columnHelper.accessor('estado', {
      header: 'Estado',
      cell: (info) => {
        const estado = info.getValue();
        const { text, color } = getEstadoInfo(estado);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
            {text}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: (info) => {
        const periodo = info.row.original;
        
        // Solo mostrar acciones si el usuario tiene rol RH
        if (!esRH) return null;
        
        return (
          <div className="flex space-x-2">
            {periodo.estado === EstadoPeriodo.BORRADOR && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirmAction(periodo, 'abrir')}
                title="Abrir periodo"
              >
                <FaCheck className="text-green-500" />
              </Button>
            )}
            {periodo.estado === EstadoPeriodo.ABIERTO && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirmAction(periodo, 'cerrar')}
                title="Cerrar periodo"
              >
                <FaLock className="text-yellow-500" />
              </Button>
            )}
            {periodo.estado === EstadoPeriodo.CERRADO && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirmAction(periodo, 'reportar')}
                title="Reportar periodo"
              >
                <FaFileAlt className="text-blue-500" />
              </Button>
            )}
          </div>
        );
      },
    }),
  ];

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Periodos</h1>
          {esRH && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center"
            >
              <FaPlus className="mr-2" /> Nuevo Periodo
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <DataTable columns={columns} data={periodos} />
        )}

        {/* Modal para crear periodo */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Crear Periodo"
        >
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <Input
              label="Nombre"
              placeholder="Ej: Enero 2025"
              {...createForm.register('nombre')}
              error={createForm.formState.errors.nombre?.message}
            />
            <Input
              label="Fecha de inicio"
              type="date"
              {...createForm.register('fechaInicio')}
              error={createForm.formState.errors.fechaInicio?.message}
            />
            <Input
              label="Fecha de fin"
              type="date"
              {...createForm.register('fechaFin')}
              error={createForm.formState.errors.fechaFin?.message}
            />
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={createPeriodoMutation.isPending}
              >
                Crear
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal de confirmación para cambios de estado */}
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title={`Confirmar acción: ${accionConfirmacion} periodo`}
          size="sm"
        >
          <div className="space-y-4">
            <p>
              ¿Estás seguro de que deseas {accionConfirmacion} el periodo "{selectedPeriodo?.nombre}"?
            </p>
            {accionConfirmacion === 'abrir' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-sm text-yellow-700">
                  <strong>Nota:</strong> Solo puede haber un periodo abierto a la vez.
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmExecute}
                isLoading={
                  abrirPeriodoMutation.isPending || 
                  cerrarPeriodoMutation.isPending || 
                  reportarPeriodoMutation.isPending
                }
              >
                Confirmar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};
