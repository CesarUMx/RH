import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaUserTie, FaTimesCircle } from 'react-icons/fa';
import { createColumnHelper } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { departamentosService, type Departamento } from '../services/departamentos.service';
import { usuariosService, type Usuario } from '../services/usuarios.service';

const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  descripcion: z.string().optional(),
  activo: z.boolean(),
});
type FormData = z.infer<typeof schema>;

const columnHelper = createColumnHelper<Departamento>();

export const Departamentos = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [coordOpen, setCoordOpen] = useState(false);
  const [selected, setSelected] = useState<Departamento | null>(null);
  const [coordSearch, setCoordSearch] = useState('');
  const [coordUserId, setCoordUserId] = useState<number | null>(null);

  const { data: departamentos = [], isLoading } = useQuery({
    queryKey: ['departamentos'],
    queryFn: departamentosService.getAll,
  });

  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
    enabled: coordOpen,
  });

  const createMutation = useMutation({
    mutationFn: departamentosService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      setCreateOpen(false);
      toast.success('Departamento creado');
      createForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => departamentosService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      setEditOpen(false);
      toast.success('Departamento actualizado');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => departamentosService.delete(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      setDeleteOpen(false);
      toast.success(result.mensaje);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al eliminar'),
  });

  const asignarCoordMutation = useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      departamentosService.asignarCoordinador(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      setCoordOpen(false);
      toast.success('Coordinador asignado');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al asignar coordinador'),
  });

  const quitarCoordMutation = useMutation({
    mutationFn: (id: number) => departamentosService.quitarCoordinador(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      setSelected((prev) => prev ? { ...prev, coordinador: null, coordinadorId: null } : null);
      toast.success('Coordinador removido');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al quitar coordinador'),
  });

  const createForm = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { nombre: '', activo: true } });
  const editForm = useForm<FormData>({ resolver: zodResolver(schema) });

  const handleEdit = (dep: Departamento) => {
    setSelected(dep);
    editForm.reset({ nombre: dep.nombre, descripcion: dep.descripcion ?? '', activo: dep.activo });
    setEditOpen(true);
  };

  const handleDelete = (dep: Departamento) => {
    setSelected(dep);
    setDeleteOpen(true);
  };

  const handleCoord = (dep: Departamento) => {
    setSelected(dep);
    setCoordUserId(dep.coordinadorId ?? null);
    setCoordSearch('');
    setCoordOpen(true);
  };

  const usuariosFiltrados = useMemo(() => {
    const q = coordSearch.toLowerCase().trim();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.correo.toLowerCase().includes(q)
    );
  }, [usuarios, coordSearch]);

  const columns: any[] = [
    columnHelper.accessor('nombre', { header: 'Nombre' }),
    columnHelper.accessor('descripcion', {
      header: 'Descripción',
      cell: (info) => info.getValue() ?? <span className="text-gray-400 italic">—</span>,
    }),
    columnHelper.accessor('coordinador', {
      header: 'Coordinador',
      cell: (info) => {
        const coord = info.getValue();
        return coord ? (
          <span className="text-sm text-gray-700">{coord.nombre}</span>
        ) : (
          <span className="text-gray-400 italic text-sm">Sin coordinador</span>
        );
      },
    }),
    columnHelper.accessor('activo', {
      header: 'Activo',
      cell: (info) =>
        info.getValue() ? <FaCheck className="h-4 w-4 text-green-500" /> : <FaTimes className="h-4 w-4 text-red-500" />,
    }),
    columnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: (info) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleCoord(info.row.original)} title="Asignar coordinador">
            <FaUserTie className="h-4 w-4 text-blue-500" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleEdit(info.row.original)}>
            <FaEdit className="h-4 w-4 text-primary" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDelete(info.row.original)}>
            <FaTrash className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Departamentos</h1>
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <FaPlus className="h-4 w-4" /> Nuevo Departamento
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        ) : (
          <DataTable columns={columns} data={departamentos} />
        )}

        {/* Modal Crear */}
        <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Departamento">
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <Input label="Nombre" {...createForm.register('nombre')} error={createForm.formState.errors.nombre?.message} />
            <Input label="Descripción (opcional)" {...createForm.register('descripcion')} />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="c-activo" {...createForm.register('activo')} className="h-4 w-4 text-primary rounded border-gray-300" />
              <label htmlFor="c-activo" className="text-sm text-gray-700">Activo</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Crear</Button>
            </div>
          </form>
        </Modal>

        {/* Modal Editar */}
        <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Editar Departamento">
          <form
            onSubmit={editForm.handleSubmit((d) => selected && updateMutation.mutate({ id: selected.id, data: d }))}
            className="space-y-4"
          >
            <Input label="Nombre" {...editForm.register('nombre')} error={editForm.formState.errors.nombre?.message} />
            <Input label="Descripción (opcional)" {...editForm.register('descripcion')} />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="e-activo" {...editForm.register('activo')} className="h-4 w-4 text-primary rounded border-gray-300" />
              <label htmlFor="e-activo" className="text-sm text-gray-700">Activo</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </Modal>

        {/* Modal Coordinador */}
        <Modal
          isOpen={coordOpen}
          onClose={() => setCoordOpen(false)}
          title={`Coordinador — ${selected?.nombre ?? ''}`}
        >
          <div className="space-y-4">
            {/* Coordinador actual */}
            {selected?.coordinador ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{selected.coordinador.nombre}</p>
                  <p className="text-xs text-gray-500">{selected.coordinador.correo}</p>
                </div>
                <button
                  onClick={() => selected && quitarCoordMutation.mutate(selected.id)}
                  disabled={quitarCoordMutation.isPending}
                  className="text-red-500 hover:text-red-700 disabled:opacity-50"
                  title="Quitar coordinador"
                >
                  <FaTimesCircle />
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Sin coordinador asignado</p>
            )}

            {/* Buscador de usuarios */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar usuario
              </label>
              <input
                type="text"
                value={coordSearch}
                onChange={(e) => setCoordSearch(e.target.value)}
                placeholder="Nombre o correo..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Lista de usuarios */}
            <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
              {usuariosFiltrados.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>
              )}
              {usuariosFiltrados.map((u) => (
                <label
                  key={u.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                    coordUserId === u.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="coordUser"
                    value={u.id}
                    checked={coordUserId === u.id}
                    onChange={() => setCoordUserId(u.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">{u.correo}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCoordOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!coordUserId || coordUserId === selected?.coordinadorId}
                isLoading={asignarCoordMutation.isPending}
                onClick={() => selected && coordUserId && asignarCoordMutation.mutate({ id: selected.id, userId: coordUserId })}
              >
                Asignar coordinador
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Eliminar */}
        <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar Departamento">
          <p className="text-gray-600 mb-6">
            ¿Confirmas eliminar el departamento <strong>{selected?.nombre}</strong>?
            {' '}Si tiene cuentas asociadas, se marcará como inactivo.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              isLoading={deleteMutation.isPending}
              onClick={() => selected && deleteMutation.mutate(selected.id)}
            >
              Eliminar
            </Button>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};
