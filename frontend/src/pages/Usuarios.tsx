import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaEdit, FaTrash, FaPlus, FaCheck, FaTimes } from 'react-icons/fa';
import { createColumnHelper } from '@tanstack/react-table';

import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

import { usuariosService } from '../services/usuarios.service';
import type { Usuario, CreateUsuarioDto, UpdateUsuarioDto } from '../services/usuarios.service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createUsuarioSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  correo: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  roles: z.array(z.string()).min(1, 'Debe seleccionar al menos un rol'),
  activo: z.boolean().default(true)
});

// Esquema de validación para editar usuario
const updateUsuarioSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  roles: z.array(z.string()).min(1, 'Debe seleccionar al menos un rol'),
  activo: z.boolean().default(true)
});

type CreateUsuarioForm = z.infer<typeof createUsuarioSchema>;
type UpdateUsuarioForm = z.infer<typeof updateUsuarioSchema>;
export const Usuarios = () => {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);

  // Consulta para obtener usuarios
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
  });

  // Consulta para obtener roles
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: usuariosService.getRoles,
  });

  // Mutación para crear usuario
  const createUsuarioMutation = useMutation({
    mutationFn: (data: CreateUsuarioDto) => usuariosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setIsCreateModalOpen(false);
      toast.success('Usuario creado correctamente');
      createForm.reset();
    },
    onError: (error) => {
      console.error('Error al crear usuario:', error);
      toast.error('Error al crear usuario');
    },
  });

  // Mutación para actualizar usuario
  const updateUsuarioMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUsuarioDto }) => 
      usuariosService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setIsEditModalOpen(false);
      toast.success('Usuario actualizado correctamente');
    },
    onError: (error) => {
      console.error('Error al actualizar usuario:', error);
      toast.error('Error al actualizar usuario');
    },
  });

  // Mutación para eliminar usuario
  const deleteUsuarioMutation = useMutation({
    mutationFn: (id: number) => usuariosService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setIsDeleteModalOpen(false);
      toast.success('Usuario eliminado correctamente');
    },
    onError: (error) => {
      console.error('Error al eliminar usuario:', error);
      toast.error('Error al eliminar usuario');
    },
  });

  // Formulario para crear usuario
  const createForm = useForm({
    resolver: zodResolver(createUsuarioSchema),
    defaultValues: {
      nombre: '',
      correo: '',
      password: '',
      roles: [],
      activo: true,
    },
  });

  // Formulario para editar usuario
  const editForm = useForm({
    resolver: zodResolver(updateUsuarioSchema),
    defaultValues: {
      nombre: '',
      roles: [],
      activo: true,
    },
  });

  // Función para abrir modal de edición
  const handleEdit = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    editForm.reset({
      nombre: usuario.nombre,
      roles: usuario.roles,
      activo: usuario.activo,
    });
    setIsEditModalOpen(true);
  };

  // Función para abrir modal de eliminación
  const handleDelete = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    setIsDeleteModalOpen(true);
  };

  // Función para manejar la creación de usuario
  const handleCreateSubmit = (data: CreateUsuarioForm) => {
    createUsuarioMutation.mutate(data);
  };

  // Función para manejar la actualización de usuario
  const handleEditSubmit = (data: UpdateUsuarioForm) => {
    if (selectedUsuario) {
      updateUsuarioMutation.mutate({
        id: selectedUsuario.id,
        data,
      });
    }
  };

  // Función para manejar la eliminación de usuario
  const handleDeleteConfirm = () => {
    if (selectedUsuario) {
      deleteUsuarioMutation.mutate(selectedUsuario.id);
    }
  };

  // Configuración de columnas para la tabla
  const columnHelper = createColumnHelper<Usuario>();
  const columns: any[] = [
    columnHelper.accessor('nombre', {
      header: 'Nombre',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('correo', {
      header: 'Correo',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('roles', {
      header: 'Roles',
      cell: (info) => info.getValue().join(', '),
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(info.row.original)}
          >
            <FaEdit className="text-primary" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(info.row.original)}
          >
            <FaTrash className="text-red-500" />
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center"
          >
            <FaPlus className="mr-2" /> Nuevo Usuario
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <DataTable columns={columns} data={usuarios} />
        )}

        {/* Modal para crear usuario */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Crear Usuario"
        >
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <Input
              label="Nombre"
              {...createForm.register('nombre')}
              error={createForm.formState.errors.nombre?.message}
            />
            <Input
              label="Correo electrónico"
              type="email"
              {...createForm.register('correo')}
              error={createForm.formState.errors.correo?.message}
            />
            <Input
              label="Contraseña"
              type="password"
              {...createForm.register('password')}
              error={createForm.formState.errors.password?.message}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roles
              </label>
              <div className="space-y-2">
                {roles.map((rol) => (
                  <div key={rol.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`create-rol-${rol.id}`}
                      value={rol.nombre}
                      {...createForm.register('roles')}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`create-rol-${rol.id}`}
                      className="ml-2 block text-sm text-gray-700"
                    >
                      {rol.nombre}
                    </label>
                  </div>
                ))}
              </div>
              {createForm.formState.errors.roles?.message && (
                <p className="mt-1 text-sm text-red-600">
                  {createForm.formState.errors.roles.message}
                </p>
              )}
            </div>
            
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
                isLoading={createUsuarioMutation.isPending}
              >
                Crear
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal para editar usuario */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar Usuario"
        >
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <Input
              label="Nombre"
              {...editForm.register('nombre')}
              error={editForm.formState.errors.nombre?.message}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <p className="text-gray-500 text-sm">{selectedUsuario?.correo}</p>
              <p className="text-xs text-gray-400 mt-1">El correo no se puede modificar</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roles
              </label>
              <div className="space-y-2">
                {roles.map((rol) => (
                  <div key={rol.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`edit-rol-${rol.id}`}
                      value={rol.nombre}
                      {...editForm.register('roles')}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`edit-rol-${rol.id}`}
                      className="ml-2 block text-sm text-gray-700"
                    >
                      {rol.nombre}
                    </label>
                  </div>
                ))}
              </div>
              {editForm.formState.errors.roles?.message && (
                <p className="mt-1 text-sm text-red-600">
                  {editForm.formState.errors.roles.message}
                </p>
              )}
            </div>
            
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
                isLoading={updateUsuarioMutation.isPending}
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
          title="Eliminar Usuario"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              ¿Está seguro que desea eliminar al usuario <span className="font-semibold">{selectedUsuario?.nombre}</span>?
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
                isLoading={deleteUsuarioMutation.isPending}
                onClick={handleDeleteConfirm}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};
