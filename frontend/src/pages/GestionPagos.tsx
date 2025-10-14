import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaFileInvoiceDollar, FaLock, FaFileExcel } from 'react-icons/fa';

import { DescargaReportesArea } from '../components/reportes/DescargaReportesArea';

import { MainLayout } from '../layouts/MainLayout';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { periodosService } from '../services/periodos.service';
import { gestionPagosService } from '../services/gestion-pagos.service';

export const GestionPagos = () => {
  // Estados
  const [isClosePeriodModalOpen, setIsClosePeriodModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPeriodo, setSelectedPeriodo] = useState<any>(null);
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [docenteDetalles, setDocenteDetalles] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  // El tipo de reporte ya no es necesario con la nueva visualización
  
  // Consulta para obtener periodos
  const { 
    data: periodos, 
    isLoading: isLoadingPeriodos,
    refetch: refetchPeriodos 
  } = useQuery({
    queryKey: ['periodos'],
    queryFn: periodosService.getAll
  });

  // Consulta para obtener áreas
  const { data: areas, isLoading: isLoadingAreas } = useQuery({
    queryKey: ['areas'],
    queryFn: () => gestionPagosService.getAreas()
  });

  // Consulta para obtener el reporte de pagos
  const { 
    data: reporteData, 
    isLoading: isLoadingReporte,
    refetch: refetchReporte
  } = useQuery({
    queryKey: ['reportePagos', selectedPeriodo?.id, selectedArea?.id, currentPage, pageSize, searchQuery],
    queryFn: async () => {
      if (!selectedPeriodo?.id) {
        return { data: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 } };
      }
      
      return gestionPagosService.getReportePagos(
        selectedPeriodo.id,
        selectedArea?.id || undefined,
        'general', // Usamos 'general' como valor predeterminado
        currentPage,
        pageSize,
        searchQuery
      );
    },
    enabled: !!selectedPeriodo?.id
  });

  // Consulta para obtener todas las áreas
  const { data: todasAreas } = useQuery({
    queryKey: ['todasAreas'],
    queryFn: () => gestionPagosService.getAreas(),
    enabled: !!selectedPeriodo?.id
  });

  // Mutación para cerrar periodo
  const closePeriodMutation = useMutation({
    mutationFn: (periodoId: number) => gestionPagosService.closePeriod(periodoId),
    onSuccess: async () => {
      toast.success('Periodo cerrado correctamente');
      setIsClosePeriodModalOpen(false);
      
      // Refrescar la lista de periodos
      await refetchPeriodos();
      
      // Actualizar el periodo seleccionado con el estado actualizado
      if (selectedPeriodo) {
        // Obtener los periodos actualizados directamente del servidor
        const updatedPeriodos = await periodosService.getAll();
        const updatedPeriodo = updatedPeriodos.find(p => p.id === selectedPeriodo.id);
        
        if (updatedPeriodo) {
          // Actualizar el periodo seleccionado con los datos más recientes
          setSelectedPeriodo(updatedPeriodo);
        }
      }
      
      // Refrescar los datos del reporte
      refetchReporte();
    },
    onError: (error: any) => {
      console.error('Error al cerrar periodo:', error);
      toast.error(error.response?.data?.mensaje || 'Error al cerrar el periodo');
    }
  });

  // Ya no necesitamos la mutación para editar carga

  // Función para manejar la búsqueda
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    refetchReporte();
  };

  // Función para abrir el modal de cierre de periodo
  const handleClosePeriodClick = (periodo: any) => {
    setSelectedPeriodo(periodo);
    setIsClosePeriodModalOpen(true);
  };

  // Función para confirmar el cierre de periodo
  const handleConfirmClosePeriod = () => {
    if (selectedPeriodo) {
      closePeriodMutation.mutate(selectedPeriodo.id);
    }
  };

  // Ya no necesitamos funciones de edición porque no estamos editando cargas individuales en esta vista

  // Función para mostrar detalles del docente
  const handleShowDetails = async (docenteId: number, nombreDocente: string) => {
    try {
      if (!selectedPeriodo?.id) return;
      
      // Mostrar mensaje de carga
      toast.loading('Cargando detalles...', { id: 'loading-details' });
      
      // Obtener todas las cargas del docente en este periodo
      const response = await gestionPagosService.getDocenteDetalles(selectedPeriodo.id, docenteId);
      
      // Si no hay datos, mostrar mensaje
      if (!response.data || response.data.length === 0) {
        toast.error('No se encontraron detalles para este docente');
        toast.dismiss('loading-details');
        return;
      }
      
      // Agregar el nombre del docente a los detalles para asegurar que se muestre correctamente
      const detallesConNombre = {
        ...response,
        nombreDocente: nombreDocente
      };
      
      // Guardar los detalles y abrir el modal
      setDocenteDetalles(detallesConNombre);
      setIsDetailModalOpen(true);
      toast.dismiss('loading-details');
    } catch (error) {
      console.error('Error al obtener detalles del docente:', error);
      toast.error('Error al obtener detalles del docente');
      toast.dismiss('loading-details');
    }
  };


  // Función para exportar el reporte a Excel
  const handleExportExcel = async () => {
    try {
      if (!selectedPeriodo?.id) {
        toast.error('Selecciona un periodo para exportar el reporte');
        return;
      }

      const result = await gestionPagosService.exportReporteExcel(selectedPeriodo.id);

      // Crear un enlace para descargar el archivo
      const url = window.URL.createObjectURL(new Blob([result]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte-pagos-${selectedPeriodo.nombre}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error al exportar reporte a Excel:', error);
      toast.error('Error al exportar el reporte a Excel');
    }
  };

  // Formatear importe como moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  // Procesar datos para mostrar por docente y área
  const procesarDatosPorDocenteArea = () => {
    if (!reporteData?.data || reporteData.data.length === 0 || !todasAreas) {
      return { docentesAgrupados: [], areasActivas: [] };
    }

    // Filtrar áreas activas
    const areasActivas = todasAreas.filter((area: any) => area.activo);
    
    // Agrupar cargas por docente
    const docentesMap = new Map();
    
    reporteData.data.forEach((carga: any) => {
      const docenteId = carga.docenteId;
      const areaId = carga.areaId;
      const importe = carga.importe || (carga.horas * carga.costoHora);
      
      if (!docentesMap.has(docenteId)) {
        docentesMap.set(docenteId, {
          id: docenteId,
          codigo: carga.codigoInterno,
          nombre: carga.nombreDocente,
          rfc: carga.rfc || '',
          areas: {},
          total: 0
        });
      }
      
      const docente = docentesMap.get(docenteId);
      
      if (!docente.areas[areaId]) {
        docente.areas[areaId] = 0;
      }
      
      docente.areas[areaId] += importe;
      docente.total += importe;
    });

    // Convertir el mapa a un array y ordenar por nombre
    const docentesAgrupados = Array.from(docentesMap.values())
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return { docentesAgrupados, areasActivas };
  };

  const { docentesAgrupados, areasActivas } = procesarDatosPorDocenteArea();

  // Calcular totales por área
  const totalesPorArea = areasActivas?.reduce((acc: any, area: any) => {
    acc[area.id] = 0;
    docentesAgrupados?.forEach((docente: any) => {
      acc[area.id] += docente.areas[area.id] || 0;
    });
    return acc;
  }, {});

  // Calcular total general
  const totalGeneral = docentesAgrupados?.reduce((acc: number, docente: any) => {
    return acc + docente.total;
  }, 0) || 0;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestión de Pagos</h1>

        {/* Filtros y controles */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Selector de periodo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Periodo
              </label>
              <div className="relative">
                <select
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                  value={selectedPeriodo?.id || ''}
                  onChange={(e) => {
                    const periodoId = Number(e.target.value);
                    const periodo = periodos?.find((p: any) => p.id === periodoId);
                    setSelectedPeriodo(periodo || null);
                  }}
                  disabled={isLoadingPeriodos}
                >
                  <option value="">Seleccionar periodo...</option>
                  {periodos?.map((periodo: any) => (
                    <option 
                      key={periodo.id} 
                      value={periodo.id}
                    >
                      {periodo.nombre} ({periodo.estado})
                    </option>
                  ))}
                </select>
                {selectedPeriodo && (
                  <div className="mt-1 flex items-center">
                    <span 
                      className={`inline-block w-3 h-3 rounded-full mr-2 ${
                        selectedPeriodo.estado === 'ABIERTO' ? 'bg-green-500' : 
                        selectedPeriodo.estado === 'CERRADO' ? 'bg-red-500' : 
                        'bg-gray-500'
                      }`}
                    ></span>
                    <span className="text-sm">
                      Estado: <strong>{selectedPeriodo.estado}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Selector de área */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Área (opcional)
              </label>
              <select
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={selectedArea?.id || ''}
                onChange={(e) => {
                  const areaId = Number(e.target.value);
                  const area = areas?.find((a: any) => a.id === areaId);
                  setSelectedArea(e.target.value ? area : null);
                }}
                disabled={isLoadingAreas}
              >
                <option value="">Todas las áreas</option>
                {areas?.map((area: any) => (
                  <option key={area.id} value={area.id}>
                    {area.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* El selector de tipo de reporte ha sido eliminado ya que no es necesario con la nueva visualización */}
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center mt-4">
            {/* Búsqueda */}
            <form onSubmit={handleSearch} className="flex space-x-2 mb-4 md:mb-0">
              <Input
                placeholder="Buscar por nombre o materia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-r-none"
              />
              <Button 
                type="submit"
                className="rounded-l-none"
              >
                <FaFileInvoiceDollar className="mr-2" /> Buscar
              </Button>
            </form>

            {/* Botones de acción */}
            <div className="flex space-x-2">
              {selectedPeriodo && selectedPeriodo.estado === 'ABIERTO' && (
                <Button
                  onClick={() => handleClosePeriodClick(selectedPeriodo)}
                  variant="danger"
                >
                  <FaLock className="mr-2" /> Cerrar Periodo
                </Button>
              )}
              <Button
                onClick={handleExportExcel}
                disabled={!selectedPeriodo}
              >
                <FaFileExcel className="mr-2" /> Exportar Excel
              </Button>
              {selectedPeriodo && (
                <DescargaReportesArea 
                  periodoId={selectedPeriodo.id} 
                  periodoNombre={selectedPeriodo.nombre} 
                />
              )}
            </div>
          </div>
        </div>

        {/* Tabla de reporte */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Reporte de Pagos {selectedPeriodo ? `- ${selectedPeriodo.nombre}` : ''}
            {selectedArea ? ` - ${selectedArea.nombre}` : ''}
          </h2>
          
          {isLoadingReporte ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {(!reporteData || !reporteData.data || reporteData.data.length === 0) ? (
                <div className="bg-white rounded-lg p-6 text-center">
                  <p className="text-gray-500 mb-4">No se encontraron datos para el periodo seleccionado.</p>
                  {searchQuery && (
                    <Button 
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentPage(1);
                        refetchReporte();
                      }}
                      variant="outline"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto" style={{ maxWidth: '100%', overflowX: 'auto' }}>
                    <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'auto' }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '80px' }}>Código</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '150px' }}>Nombre</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>RFC</th>
                          {areasActivas?.map((area: any) => (
                            <th key={area.id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                              {area.nombre}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>Total</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {docentesAgrupados?.map((docente: any, index: number) => (
                          <tr key={docente.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{docente.codigo}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{docente.nombre}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{docente.rfc}</td>
                            {areasActivas?.map((area: any) => (
                              <td key={area.id} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {docente.areas[area.id] ? formatCurrency(docente.areas[area.id]) : '-'}
                              </td>
                            ))}
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900">
                              {formatCurrency(docente.total)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              <Button 
                                onClick={() => handleShowDetails(docente.id, docente.nombre)}
                                variant="outline"
                                size="sm"
                              >
                                Detalles
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {/* Fila de totales */}
                        <tr className="bg-gray-100 font-bold">
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900"></td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">TOTALES</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900"></td>
                          {areasActivas?.map((area: any) => (
                            <td key={area.id} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(totalesPorArea?.[area.id] || 0)}
                            </td>
                          ))}
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(totalGeneral)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  {/* La paginación ya no es necesaria con la vista agrupada */}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmación para cerrar periodo */}
      <Modal
        isOpen={isClosePeriodModalOpen}
        onClose={() => setIsClosePeriodModalOpen(false)}
        title="Cerrar Periodo"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas cerrar el periodo <strong>{selectedPeriodo?.nombre}</strong>? 
            Una vez cerrado, no se podrán realizar más cargas de horas en este periodo.
          </p>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsClosePeriodModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmClosePeriod}
              isLoading={closePeriodMutation.isPending}
            >
              <FaLock className="mr-2" /> Cerrar Periodo
            </Button>
          </div>
        </div>
      </Modal>

      {/* El modal de edición de carga ha sido eliminado ya que no se utiliza */}

      {/* Modal de detalles del docente */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={docenteDetalles?.nombreDocente ? `Detalles de ${docenteDetalles.nombreDocente}` : 'Detalles del Docente'}
        size="lg"
      >
        {docenteDetalles ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Materia</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horas</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo/Hora</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {docenteDetalles.data?.map((carga: any, index: number) => (
                    <tr key={carga.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{carga.area}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{carga.materiaText}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{carga.horas}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{formatCurrency(carga.costoHora)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(
                          carga.importe ? 
                            Number(carga.importe) : 
                            (Number(carga.horas) * Number(carga.costoHora))
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Fila de total */}
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={4} className="px-3 py-2 text-right text-sm text-gray-900">Total:</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(
                        docenteDetalles.data?.reduce(
                          (acc: number, carga: any) => {
                            // Asegurarnos de que usamos números para el cálculo
                            const horas = Number(carga.horas);
                            const costoHora = Number(carga.costoHora);
                            const importe = carga.importe ? Number(carga.importe) : (horas * costoHora);
                            return acc + importe;
                          }, 
                          0
                        ) || 0
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => setIsDetailModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p>Cargando detalles...</p>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};
