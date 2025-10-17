import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaEdit, FaTrash, FaPlus, FaCheck, FaTimes, FaUpload, FaDownload, FaSearch } from 'react-icons/fa';
import { createColumnHelper } from '@tanstack/react-table';
import { useAuth } from '../context/AuthContext';
import { useArea } from '../context/AreaContext';

import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { FileUpload } from '../components/ui/FileUpload';

import { docentesService } from '../services/docentes.service';
import type {
  Docente,
  CreateDocenteDto,
  UpdateDocenteDto,
  ImportResult,
} from '../services/docentes.service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Esquema de validación para crear docente
const createDocenteSchema = z.object({
  codigoInterno: z.string().min(1, 'El código interno es requerido'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  rfc: z
    .string()
    .regex(
      /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/,
      'El RFC debe tener el formato correcto'
    ),
  activo: z.boolean().default(true),
});

// Esquema de validación para editar docente
const updateDocenteSchema = z.object({
  codigoInterno: z.string().min(1, 'El código interno es requerido'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  rfc: z
    .string()
    .regex(
      /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/,
      'El RFC debe tener el formato correcto'
    ),
  activo: z.boolean().default(true),
});

type CreateDocenteForm = z.infer<typeof createDocenteSchema>;
type UpdateDocenteForm = z.infer<typeof updateDocenteSchema>;

// Función para formatear el código interno a 6 dígitos
const formatCodigoInterno = (codigo: string | number): string => {
  // Convertir a string si es un número
  const codigoStr = String(codigo);
  // Rellenar con ceros a la izquierda hasta completar 6 dígitos
  return codigoStr.padStart(6, '0');
};

export const Docentes = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { selectedArea } = useArea();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedDocente, setSelectedDocente] = useState<Docente | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Efecto para forzar una recarga de los datos al montar el componente
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['docentes'] });
  }, [queryClient]);

  // Consulta para obtener docentes paginados
  const { data: docentesPaginados, isLoading, error } = useQuery({
    queryKey: ['docentes', searchQuery, currentPage, pageSize],
    queryFn: async () => {
      try {
        // Usar valores fijos para evitar NaN
        const page = Number.isInteger(currentPage) && currentPage > 0 ? currentPage : 1;
        const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
        
        // Usar el servicio de docentes
        const result = await docentesService.getAll(searchQuery, page, size);
        
        // Validar la respuesta
        if (!result || !result.data) {
          throw new Error('Invalid response from API');
        }
        
        return {
          data: result.data || [],
          pagination: {
            total: Number(result.pagination?.total) || 0,
            page: Number(result.pagination?.page) || page,
            pageSize: Number(result.pagination?.pageSize) || size,
            totalPages: Number(result.pagination?.totalPages) || 1
          }
        };
      } catch (error) {
        console.error('Error fetching docentes:', error);
        return {
          data: [],
          pagination: {
            total: 0,
            page: currentPage || 1,
            pageSize: pageSize || 10,
            totalPages: 1
          }
        };
      }
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Mutación para crear docente
  const createDocenteMutation = useMutation({
    mutationFn: (data: CreateDocenteDto) => docentesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
      setIsCreateModalOpen(false);
      toast.success('Docente creado correctamente');
      createForm.reset();
    },
    onError: (error) => {
      console.error('Error al crear docente:', error);
      toast.error('Error al crear docente');
    },
  });

  // Mutación para actualizar docente
  const updateDocenteMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDocenteDto }) =>
      docentesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
      setIsEditModalOpen(false);
      toast.success('Docente actualizado correctamente');
    },
    onError: (error) => {
      console.error('Error al actualizar docente:', error);
      toast.error('Error al actualizar docente');
    },
  });

  // Mutación para eliminar docente
  const deleteDocenteMutation = useMutation({
    mutationFn: (id: number) => docentesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
      setIsDeleteModalOpen(false);
      toast.success('Docente eliminado correctamente');
    },
    onError: (error) => {
      console.error('Error al eliminar docente:', error);
      toast.error('Error al eliminar docente');
    },
  });

  // Mutación para importar docentes
  const importDocentesMutation = useMutation({
    mutationFn: (file: File) => docentesService.import(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
      setImportResult(data);
      setIsImporting(false);
      toast.success(`Importación completada: ${data.insertados} insertados, ${data.actualizados} actualizados`);
    },
    onError: (error) => {
      console.error('Error al importar docentes:', error);
      toast.error('Error al importar docentes');
      setIsImporting(false);
    },
  });

  // Formulario para crear docente
  const createForm = useForm({
    resolver: zodResolver(createDocenteSchema),
    defaultValues: {
      codigoInterno: '',
      nombre: '',
      rfc: '',
      activo: true,
    },
  });

  // Formulario para editar docente
  const editForm = useForm({
    resolver: zodResolver(updateDocenteSchema),
    defaultValues: {
      codigoInterno: '',
      nombre: '',
      rfc: '',
      activo: true,
    },
  });

  // Función para abrir modal de edición
  const handleEdit = (docente: Docente) => {
    setSelectedDocente(docente);
    editForm.reset({
      codigoInterno: docente.codigoInterno,
      nombre: docente.nombre,
      rfc: docente.rfc,
      activo: docente.activo,
    });
    setIsEditModalOpen(true);
  };

  // Función para abrir modal de eliminación
  const handleDelete = (docente: Docente) => {
    setSelectedDocente(docente);
    setIsDeleteModalOpen(true);
  };

  // Función para manejar la creación de docente
  const handleCreateSubmit = (data: CreateDocenteForm) => {
    // Formatear el código interno a 6 dígitos
    const formattedData = {
      ...data,
      codigoInterno: formatCodigoInterno(data.codigoInterno)
    };
    createDocenteMutation.mutate(formattedData);
  };

  // Función para manejar la actualización de docente
  const handleEditSubmit = (data: UpdateDocenteForm) => {
    if (selectedDocente) {
      // Formatear el código interno a 6 dígitos
      const formattedData = {
        ...data,
        codigoInterno: formatCodigoInterno(data.codigoInterno)
      };
      updateDocenteMutation.mutate({
        id: selectedDocente.id,
        data: formattedData,
      });
    }
  };

  // Función para manejar la eliminación de docente
  const handleDeleteConfirm = () => {
    if (selectedDocente) {
      deleteDocenteMutation.mutate(selectedDocente.id);
    }
  };

  // Función para manejar la importación de docentes
  const handleImport = () => {
    if (importFile) {
      setIsImporting(true);
      setImportResult(null);
      importDocentesMutation.mutate(importFile);
    }
  };

  // Función para manejar la búsqueda
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    queryClient.invalidateQueries({ queryKey: ['docentes'] });
  };

  // Función para descargar archivo de errores
  const handleDownloadErrores = () => {
    if (importResult?.erroresArchivo) {
      window.open(importResult.erroresArchivo, '_blank');
    }
  };

  // Configuración de columnas para la tabla
  const columnHelper = createColumnHelper<Docente>();
  const columns: any[] = [
    columnHelper.accessor('codigoInterno', {
      header: 'Código Interno',
      cell: (info) => formatCodigoInterno(info.getValue()),
    }),
    columnHelper.accessor('nombre', {
      header: 'Nombre',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('rfc', {
      header: 'RFC',
      cell: (info) => info.getValue(),
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
  ];
  
  // Solo mostrar columna de acciones para ADMIN y RH
  if (!hasRole('COORD') || hasRole(['ADMIN', 'RH'])) {
    columns.push(
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
      })
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Gestión de Docentes</h1>
          </div>
          
          {/* Mostrar botones de acción solo para ADMIN y RH */}
          {(!hasRole('COORD') || hasRole(['ADMIN', 'RH'])) && (
            <div className="flex space-x-2">
              <Button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center"
                variant="secondary"
              >
                <FaUpload className="mr-2" /> Importar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    toast.loading('Descargando plantilla...');
                    await docentesService.downloadTemplate();
                    toast.dismiss();
                    toast.success('Plantilla descargada correctamente');
                  } catch (error) {
                    toast.dismiss();
                    toast.error('Error al descargar la plantilla');
                    console.error('Error al descargar plantilla:', error);
                  }
                }}
                className="flex items-center"
                variant="outline"
              >
                <FaDownload className="mr-2" /> Descargar Plantilla
              </Button>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center"
              >
                <FaPlus className="mr-2" /> Nuevo Docente
              </Button>
            </div>
          )}
        </div>

        {/* Barra de búsqueda */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex">
            <Input
              placeholder="Buscar por código, nombre o RFC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-r-none"
            />
            <Button
              type="submit"
              className="rounded-l-none"
            >
              <FaSearch />
            </Button>
          </div>
        </form>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Si hay un error o no hay datos, mostrar un mensaje */}
            {(!docentesPaginados || docentesPaginados.data.length === 0) && !isLoading ? (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500 mb-4">No se encontraron docentes con los criterios de búsqueda actuales.</p>
                {searchQuery && (
                  <Button 
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    variant="outline"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                <DataTable 
                  columns={columns} 
                  data={docentesPaginados?.data || []} 
                />
                
                {/* Componente de paginación personalizado */}
                {docentesPaginados && docentesPaginados.pagination && (
                  <Pagination
                    currentPage={docentesPaginados.pagination.page}
                    pageCount={docentesPaginados.pagination.totalPages}
                    totalItems={docentesPaginados.pagination.total}
                    pageSize={docentesPaginados.pagination.pageSize}
                    onPageChange={(page) => {
                      setCurrentPage(page);
                    }}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Modal para crear docente */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Crear Docente"
        >
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <Input
              label="Código Interno"
              {...createForm.register('codigoInterno')}
              error={createForm.formState.errors.codigoInterno?.message}
            />
            <Input
              label="Nombre"
              {...createForm.register('nombre')}
              error={createForm.formState.errors.nombre?.message}
            />
            <Input
              label="RFC"
              {...createForm.register('rfc')}
              error={createForm.formState.errors.rfc?.message}
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
                isLoading={createDocenteMutation.isPending}
              >
                Crear
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal para editar docente */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar Docente"
        >
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <Input
              label="Código Interno"
              {...editForm.register('codigoInterno')}
              error={editForm.formState.errors.codigoInterno?.message}
            />
            <Input
              label="Nombre"
              {...editForm.register('nombre')}
              error={editForm.formState.errors.nombre?.message}
            />
            <Input
              label="RFC"
              {...editForm.register('rfc')}
              error={editForm.formState.errors.rfc?.message}
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
                isLoading={updateDocenteMutation.isPending}
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
          title="Eliminar Docente"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              ¿Está seguro que desea eliminar al docente <span className="font-semibold">{selectedDocente?.nombre}</span>?
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
                isLoading={deleteDocenteMutation.isPending}
                onClick={handleDeleteConfirm}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal para importar docentes */}
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => {
            if (!isImporting) {
              setIsImportModalOpen(false);
              setImportResult(null);
              setImportFile(null);
            }
          }}
          title="Importar Docentes"
          size="lg"
        >
          <div className="space-y-6">
            {!importResult ? (
              <>
                <div className="bg-blue-50 border-l-4 border-primary p-4 mb-4">
                  <div className="flex">
                    <div className="ml-3 w-full">
                      <p className="text-sm text-blue-700">
                        <strong>Formato requerido:</strong> Archivo CSV o Excel con las columnas:
                      </p>
                      <ul className="list-disc pl-5 mt-1 text-sm text-blue-700">
                        <li>codigo_interno (obligatorio)</li>
                        <li>nombre (obligatorio)</li>
                        <li>rfc (obligatorio)</li>
                        <li>activo (opcional, por defecto: true)</li>
                      </ul>
                      <div className="mt-3 flex justify-end">
                        <button 
                          type="button"
                          onClick={async () => {
                            try {
                              toast.loading('Descargando plantilla...');
                              await docentesService.downloadTemplate();
                              toast.dismiss();
                              toast.success('Plantilla descargada correctamente');
                            } catch (error) {
                              toast.dismiss();
                              toast.error('Error al descargar la plantilla');
                              console.error('Error al descargar plantilla:', error);
                            }
                          }}
                          className="text-primary hover:text-primary-dark text-sm font-medium flex items-center"
                        >
                          <FaDownload className="mr-1" /> Descargar plantilla
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <FileUpload
                  onFileSelect={(file) => setImportFile(file)}
                  accept=".csv,.xlsx,.xls"
                  label="Selecciona o arrastra un archivo CSV o Excel"
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsImportModalOpen(false)}
                    disabled={isImporting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={!importFile || isImporting}
                    isLoading={isImporting}
                  >
                    Importar
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border-l-4 border-green-500 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-green-700">
                        <strong>Importación completada</strong>
                      </p>
                      <ul className="mt-1 text-sm text-green-700">
                        <li>Total de registros: {importResult.total}</li>
                        <li>Registros insertados: {importResult.insertados}</li>
                        <li>Registros actualizados: {importResult.actualizados}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {importResult.errores.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium text-gray-900">Errores encontrados</h3>
                    <div className="bg-red-50 border-l-4 border-red-500 p-4">
                      <p className="text-sm text-red-700">
                        Se encontraron {importResult.errores.length} errores durante la importación.
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Línea
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Código
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              RFC
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Error
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {importResult.errores.map((error, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {error.linea}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {error.codigoInterno || '-'}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {error.rfc || '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-red-600">
                                {error.error}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {importResult.erroresArchivo && (
                      <Button
                        variant="outline"
                        onClick={handleDownloadErrores}
                        className="flex items-center"
                      >
                        <FaDownload className="mr-2" /> Descargar reporte de errores
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportResult(null);
                      setImportFile(null);
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};
