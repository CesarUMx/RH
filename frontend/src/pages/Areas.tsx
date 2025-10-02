import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaEdit, FaTrash, FaPlus, FaCheck, FaTimes, FaUserPlus } from 'react-icons/fa';
import { createColumnHelper } from '@tanstack/react-table';

import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

import { areasService } from '../services/areas.service';
import type { Area, CreateAreaDto, UpdateAreaDto } from '../services/areas.service';
import { usuariosService } from '../services/usuarios.service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';

// Esquema de validación para crear/editar área
const areaSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  activo: z.boolean().default(true),
});

type AreaForm = z.infer<typeof areaSchema>;

export const Areas = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCoordinadoresModalOpen, setIsCoordinadoresModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedCoordinadorId, setSelectedCoordinadorId] = useState<number | null>(null);

  // Consulta para obtener áreas
  const { data: areas = [], isLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: areasService.getAll,
  });

  // Consulta para obtener usuarios con rol COORD
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
    select: (data) => data.filter(u => u.roles.includes('COORD') && u.activo),
  });

  // Consulta para obtener coordinadores de un área
  const { data: coordinadores = [], refetch: refetchCoordinadores } = useQuery({
    queryKey: ['coordinadores', selectedArea?.id],
    queryFn: () => selectedArea ? areasService.getCoordinadores(selectedArea.id) : Promise.resolve([]),
    enabled: !!selectedArea,
  });

  // Mutación para crear área
  const createAreaMutation = useMutation({
    mutationFn: (data: CreateAreaDto) => areasService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      setIsCreateModalOpen(false);
      toast.success('Área creada correctamente');
      createForm.reset();
    },
    onError: (error) => {
      console.error('Error al crear área:', error);
      toast.error('Error al crear área');
    },
  });

  // Mutación para actualizar área
  const updateAreaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAreaDto }) => 
      areasService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      setIsEditModalOpen(false);
      toast.success('Área actualizada correctamente');
    },
    onError: (error) => {
      console.error('Error al actualizar área:', error);
      toast.error('Error al actualizar área');
    },
  });

  // Mutación para eliminar área
  const deleteAreaMutation = useMutation({
    mutationFn: (id: number) => areasService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      setIsDeleteModalOpen(false);
      toast.success('Área eliminada correctamente');
    },
    onError: (error) => {
      console.error('Error al eliminar área:', error);
      toast.error('Error al eliminar área');
    },
  });

  // Mutación para asignar coordinador
  const asignarCoordinadorMutation = useMutation({
    mutationFn: ({ areaId, userId }: { areaId: number; userId: number }) => 
      areasService.asignarCoordinador(areaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['coordinadores', selectedArea?.id] });
      toast.success('Coordinador asignado correctamente');
      setSelectedCoordinadorId(null);
    },
    onError: (error) => {
      console.error('Error al asignar coordinador:', error);
      toast.error('Error al asignar coordinador');
    },
  });

  // Mutación para eliminar coordinador
  const eliminarCoordinadorMutation = useMutation({
    mutationFn: ({ areaId, userId }: { areaId: number; userId: number }) => 
      areasService.eliminarCoordinador(areaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['coordinadores', selectedArea?.id] });
      toast.success('Coordinador eliminado correctamente');
    },
    onError: (error) => {
      console.error('Error al eliminar coordinador:', error);
      toast.error('Error al eliminar coordinador');
    },
  });

  // Formulario para crear área
  const createForm = useForm({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      nombre: '',
      activo: true,
    },
  });

  // Formulario para editar área
  const editForm = useForm({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      nombre: '',
      activo: true,
    },
  });

  // Función para abrir modal de edición
  const handleEdit = (area: Area) => {
    setSelectedArea(area);
    editForm.reset({
      nombre: area.nombre,
      activo: area.activo,
    });
    setIsEditModalOpen(true);
  };

  // Función para abrir modal de eliminación
  const handleDelete = (area: Area) => {
    setSelectedArea(area);
    setIsDeleteModalOpen(true);
  };

  // Función para abrir modal de coordinadores
  const handleCoordinadores = (area: Area) => {
    setSelectedArea(area);
    refetchCoordinadores();
    setIsCoordinadoresModalOpen(true);
  };

  // Función para manejar la creación de área
  const handleCreateSubmit = (data: AreaForm) => {
    createAreaMutation.mutate(data);
  };

  // Función para manejar la actualización de área
  const handleEditSubmit = (data: AreaForm) => {
    if (selectedArea) {
      updateAreaMutation.mutate({
        id: selectedArea.id,
        data,
      });
    }
  };

  // Función para manejar la eliminación de área
  const handleDeleteConfirm = () => {
    if (selectedArea) {
      deleteAreaMutation.mutate(selectedArea.id);
    }
  };

  // Función para asignar coordinador
  const handleAsignarCoordinador = () => {
    if (selectedArea && selectedCoordinadorId) {
      asignarCoordinadorMutation.mutate({
        areaId: selectedArea.id,
        userId: selectedCoordinadorId,
      });
    }
  };

  // Función para eliminar coordinador
  const handleEliminarCoordinador = (userId: number) => {
    if (selectedArea) {
      eliminarCoordinadorMutation.mutate({
        areaId: selectedArea.id,
        userId,
      });
    }
  };

  // Filtrar usuarios que no son coordinadores del área seleccionada
  const usuariosDisponibles = usuarios.filter(
    (usuario) => !coordinadores.some((coord) => coord.id === usuario.id)
  );

  // Configuración de columnas para la tabla
  const columnHelper = createColumnHelper<Area>();
  const columns: any[] = [
    columnHelper.accessor('nombre', {
      header: 'Nombre',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('coordinadores', {
      header: 'Coordinadores',
      cell: (info) => {
        const coordinadores = info.getValue();
        return coordinadores.length > 0
          ? coordinadores.map(c => c.nombre).join(', ')
          : 'Sin coordinadores';
      },
    }),
    columnHelper.accessor('activo', {
      header: 'Activo',
      cell: (info) => (
        <span className="flex items-center">
          {info.getValue() ? (
            <FaCheck className="text-green-500" />
          ) : (
            <FaTimes className="text-red-500" />
          )}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: (info) => (
        <div className="flex space-x-2">
          {(isAdmin || hasRole('RH')) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCoordinadores(info.row.original)}
              title="Gestionar coordinadores"
            >
              <FaUserPlus className="text-primary" />
            </Button>
          )}
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(info.row.original)}
                title="Editar área"
              >
                <FaEdit className="text-primary" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(info.row.original)}
                title="Eliminar área"
              >
                <FaTrash className="text-red-500" />
              </Button>
            </>
          )}
        </div>
      ),
    }),
  ];

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Áreas</h1>
          {isAdmin && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center"
            >
              <FaPlus className="mr-2" /> Nueva Área
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <DataTable columns={columns} data={areas} />
        )}

        {/* Modal para crear área */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Crear Área"
        >
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <Input
              label="Nombre"
              {...createForm.register('nombre')}
              error={createForm.formState.errors.nombre?.message}
            />
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="create-activo"
                {...createForm.register('activo')}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label
                htmlFor="create-activo"
                className="ml-2 block text-sm text-gray-700"
              >
                Activo
              </label>
            </div>
            
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
                isLoading={createAreaMutation.isPending}
              >
                Crear
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal para editar área */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar Área"
        >
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <Input
              label="Nombre"
              {...editForm.register('nombre')}
              error={editForm.formState.errors.nombre?.message}
            />
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="edit-activo"
                {...editForm.register('activo')}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label
                htmlFor="edit-activo"
                className="ml-2 block text-sm text-gray-700"
              >
                Activo
              </label>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={updateAreaMutation.isPending}
              >
                Guardar
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal para confirmar eliminación */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Eliminar Área"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              ¿Está seguro que desea eliminar el área <span className="font-semibold">{selectedArea?.nombre}</span>?
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={deleteAreaMutation.isPending}
                onClick={handleDeleteConfirm}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal para gestionar coordinadores */}
        <Modal
          isOpen={isCoordinadoresModalOpen}
          onClose={() => setIsCoordinadoresModalOpen(false)}
          title={`Coordinadores - ${selectedArea?.nombre}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Coordinadores actuales */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Coordinadores asignados</h3>
              {coordinadores.length === 0 ? (
                <p className="text-gray-500">No hay coordinadores asignados a esta área.</p>
              ) : (
                <ul className="divide-y divide-gray-200 border rounded-md">
                  {coordinadores.map((coordinador) => (
                    <li key={coordinador.id} className="flex justify-between items-center p-3">
                      <div>
                        <p className="font-medium">{coordinador.nombre}</p>
                        <p className="text-sm text-gray-500">{coordinador.correo}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEliminarCoordinador(coordinador.id)}
                      >
                        <FaTrash className="text-red-500" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Asignar nuevo coordinador */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Asignar nuevo coordinador</h3>
              {usuariosDisponibles.length === 0 ? (
                <p className="text-gray-500">No hay usuarios disponibles con rol de Coordinador.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seleccionar usuario
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={selectedCoordinadorId || ''}
                      onChange={(e) => setSelectedCoordinadorId(Number(e.target.value) || null)}
                    >
                      <option value="">Seleccione un usuario</option>
                      {usuariosDisponibles.map((usuario) => (
                        <option key={usuario.id} value={usuario.id}>
                          {usuario.nombre} ({usuario.correo})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleAsignarCoordinador}
                    disabled={!selectedCoordinadorId}
                    isLoading={asignarCoordinadorMutation.isPending}
                    className="w-full"
                  >
                    Asignar Coordinador
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCoordinadoresModalOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};
