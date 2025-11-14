import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaCheck, FaTimes, FaEye } from 'react-icons/fa';
import { createColumnHelper } from '@tanstack/react-table';
import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { solicitudesService, ESTADO_ALTA } from '../services/solicitudes.service';
import type { SolicitudAlta, EstadoAlta, SolicitudDocumentos } from '../services/solicitudes.service';
import { API_BASE_URL } from '../services/api';

export const SolicitudesPendientes = () => {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudAlta | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoAlta | 'TODOS'>('PENDIENTE'); // Por defecto muestra las pendientes

  // Consulta para obtener solicitudes filtradas
  const { data: solicitudesPaginadas, isLoading } = useQuery({
    queryKey: ['solicitudes', filtroEstado, currentPage, pageSize],
    queryFn: () => solicitudesService.getSolicitudesFiltradas(filtroEstado, currentPage, pageSize),
  });

  // Mutación para actualizar estado de solicitud
  const actualizarEstadoMutation = useMutation({
    mutationFn: ({ id, estado, motivoRechazo }: { id: number; estado: EstadoAlta; motivoRechazo?: string }) => 
      solicitudesService.actualizarEstadoSolicitud(id, estado, motivoRechazo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      setIsApproveModalOpen(false);
      setIsRejectModalOpen(false);
      setMotivoRechazo('');
      setSelectedSolicitud(null);
    },
    onError: (error) => {
      console.error('Error al actualizar estado:', error);
      toast.error('Error al actualizar el estado de la solicitud');
    }
  });

  // Manejar cambio de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Manejar aprobación de solicitud
  const handleApprove = () => {
    if (!selectedSolicitud) return;
    
    actualizarEstadoMutation.mutate({
      id: selectedSolicitud.id,
      estado: ESTADO_ALTA.COMPLETO
    });
    
    toast.success('Solicitud aprobada correctamente');
  };

  // Manejar rechazo de solicitud
  const handleReject = () => {
    if (!selectedSolicitud || !motivoRechazo.trim()) return;
    
    actualizarEstadoMutation.mutate({
      id: selectedSolicitud.id,
      estado: ESTADO_ALTA.RECHAZADO,
      motivoRechazo
    });
    
    toast.success('Solicitud rechazada correctamente');
  };

  // Configuración de columnas para la tabla
  const columnHelper = createColumnHelper<SolicitudAlta>();
  const columns = [
    columnHelper.accessor('nombre', {
      header: 'Nombre',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('estadoAlta', {
      header: 'Estado',
      cell: (info) => {
        const estado = info.getValue();
        
        switch (estado) {
          case ESTADO_ALTA.COMPLETO:
            return <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">Aprobado</span>;
          case ESTADO_ALTA.RECHAZADO:
            return <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">Rechazado</span>;
          case ESTADO_ALTA.PENDIENTE:
            return <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">Pendiente</span>;
          default:
            return <span className="text-gray-500 text-xs">-</span>;
        }
      },
    }),
    columnHelper.accessor('createdAt', {
      header: 'Fecha de Solicitud',
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: (info) => {
        const solicitud = info.row.original;
        const isPendiente = solicitud.estadoAlta === ESTADO_ALTA.PENDIENTE;
        
        return (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedSolicitud(solicitud);
                setIsViewModalOpen(true);
              }}
              title="Ver documentos"
            >
              <FaEye className="text-blue-500" />
            </Button>
            
            {isPendiente && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSolicitud(solicitud);
                    setIsApproveModalOpen(true);
                  }}
                  title="Aprobar"
                >
                  <FaCheck className="text-green-500" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSolicitud(solicitud);
                    setIsRejectModalOpen(true);
                  }}
                  title="Rechazar"
                >
                  <FaTimes className="text-red-500" />
                </Button>
              </>
            )}
          </div>
        );
      },
    }),
  ];

  // Verificar si un documento existe
  const tieneDocumento = (key: keyof SolicitudDocumentos): boolean => {
    if (!selectedSolicitud || !selectedSolicitud.documentos) return false;
    const value = selectedSolicitud.documentos[key];
    return !!value && value !== null;
  };

  // Obtener URL de documento
  const getDocumentoUrl = (key: keyof SolicitudDocumentos): string => {
    if (!selectedSolicitud || !selectedSolicitud.documentos) return '';
    const value = selectedSolicitud.documentos[key];
    if (!value) return '';
    
    // Si la ruta ya incluye la URL completa, usarla directamente
    if (value.startsWith('http')) return value;
    
    // Si es una ruta relativa que comienza con /, agregarle la URL base del backend
    return `${API_BASE_URL}${value}`;
  };

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Solicitudes de Alta</h1>
          <p className="text-gray-600 mt-1">
            Revise y apruebe o rechace las solicitudes de alta de docentes.
          </p>
        </div>
        
        {/* Filtro de estado */}
        <div className="mb-6 flex items-center space-x-4">
          <label htmlFor="filtroEstado" className="font-medium text-gray-700">
            Filtrar por estado:
          </label>
          <div className="relative">
            <select
              id="filtroEstado"
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value as EstadoAlta | 'TODOS');
                setCurrentPage(1); // Resetear a la primera página al cambiar el filtro
              }}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md"
            >
              <option value="TODOS">Todos</option>
              <option value={ESTADO_ALTA.PENDIENTE}>Pendientes</option>
              <option value={ESTADO_ALTA.COMPLETO}>Aprobados</option>
              <option value={ESTADO_ALTA.RECHAZADO}>Rechazados</option>
            </select>
          </div>
        </div>

        {/* Tabla de solicitudes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-gray-600">Cargando solicitudes...</p>
            </div>
          ) : solicitudesPaginadas?.data.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No hay solicitudes {filtroEstado !== 'TODOS' ? `con estado ${filtroEstado}` : ''}</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={solicitudesPaginadas?.data || []}
            />
          )}
          
          {/* Paginación */}
          {solicitudesPaginadas && solicitudesPaginadas.pagination.totalPages > 1 && (
            <div className="py-4 px-6 border-t">
              <Pagination
                currentPage={currentPage}
                pageCount={solicitudesPaginadas.pagination.totalPages}
                onPageChange={handlePageChange}
                totalItems={solicitudesPaginadas.pagination.total}
                pageSize={pageSize}
              />
            </div>
          )}
        </div>

        {/* Modal para ver documentos */}
        {selectedSolicitud && (
          <Modal
            isOpen={isViewModalOpen}
            onClose={() => setIsViewModalOpen(false)}
            title={`Documentos de ${selectedSolicitud.nombre}`}
            size="lg"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Constancia Fiscal</h3>
                  {tieneDocumento('constanciaFiscal') ? (
                    <div className="border rounded p-2">
                      <a 
                        href={getDocumentoUrl('constanciaFiscal')} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <FaEye className="mr-1" /> Ver documento
                      </a>
                    </div>
                  ) : (
                    <div className="text-red-500">No disponible</div>
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Comprobante de Domicilio</h3>
                  {tieneDocumento('comprobanteDomicilio') ? (
                    <div className="border rounded p-2">
                      <a 
                        href={getDocumentoUrl('comprobanteDomicilio')} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <FaEye className="mr-1" /> Ver documento
                      </a>
                    </div>
                  ) : (
                    <div className="text-red-500">No disponible</div>
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Curriculum Vitae</h3>
                  {tieneDocumento('cv') ? (
                    <div className="border rounded p-2">
                      <a 
                        href={getDocumentoUrl('cv')} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <FaEye className="mr-1" /> Ver documento
                      </a>
                    </div>
                  ) : (
                    <div className="text-red-500">No disponible</div>
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Cuenta Bancaria</h3>
                  {tieneDocumento('cuentaBancaria') ? (
                    <div className="border rounded p-2">
                      <a 
                        href={getDocumentoUrl('cuentaBancaria')} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <FaEye className="mr-1" /> Ver documento
                      </a>
                    </div>
                  ) : (
                    <div className="text-red-500">No disponible</div>
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">INE</h3>
                  {tieneDocumento('ine') ? (
                    <div className="border rounded p-2">
                      <a 
                        href={getDocumentoUrl('ine')} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <FaEye className="mr-1" /> Ver documento
                      </a>
                    </div>
                  ) : (
                    <div className="text-red-500">No disponible</div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => setIsViewModalOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal para aprobar solicitud */}
        {selectedSolicitud && (
          <Modal
            isOpen={isApproveModalOpen}
            onClose={() => setIsApproveModalOpen(false)}
            title="Aprobar Solicitud"
            size="md"
          >
            <div className="space-y-6">
              <p className="text-gray-700">
                ¿Está seguro que desea aprobar la solicitud de <strong>{selectedSolicitud.nombre}</strong>?
              </p>
              <p className="text-gray-700">
                Al aprobar la solicitud, se creará un nuevo docente en el sistema con los datos proporcionados.
              </p>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsApproveModalOpen(false)}
                >
                  Cancelar
                </Button>
                
                <Button
                  onClick={handleApprove}
                  isLoading={actualizarEstadoMutation.isPending}
                >
                  Aprobar
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal para rechazar solicitud */}
        {selectedSolicitud && (
          <Modal
            isOpen={isRejectModalOpen}
            onClose={() => setIsRejectModalOpen(false)}
            title="Rechazar Solicitud"
            size="md"
          >
            <div className="space-y-6">
              <p className="text-gray-700">
                ¿Está seguro que desea rechazar la solicitud de <strong>{selectedSolicitud.nombre}</strong>?
              </p>
              
              <div>
                <label htmlFor="motivoRechazo" className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de Rechazo (requerido)
                </label>
                <textarea
                  id="motivoRechazo"
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  rows={4}
                  placeholder="Explique el motivo por el cual se rechaza la solicitud..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsRejectModalOpen(false)}
                >
                  Cancelar
                </Button>
                
                <Button
                  variant="danger"
                  onClick={handleReject}
                  disabled={!motivoRechazo.trim()}
                  isLoading={actualizarEstadoMutation.isPending}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
};
