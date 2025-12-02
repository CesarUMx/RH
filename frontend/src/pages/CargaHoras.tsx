import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaDownload, FaEye, FaCheck, FaTimes, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';

import { MainLayout } from '../layouts/MainLayout';
import { Button } from '../components/ui/Button';
import { FileUpload } from '../components/ui/FileUpload';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { useArea } from '../context/AreaContext';
import { useAuth } from '../context/AuthContext';
import { periodosService } from '../services/periodos.service';
import { cargaHorasService } from '../services/carga-horas.service';
import { docentesService } from '../services/docentes.service';
import { FaExclamationTriangle } from 'react-icons/fa';

export const CargaHoras = () => {
  const { selectedArea } = useArea();
  const { hasRole, user } = useAuth();

  // Estado para el modal de confirmación de eliminación
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cargaToDelete, setCargaToDelete] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState(false);
  const [sugerenciasDocentes, setSugerenciasDocentes] = useState<Array<{ id: number, nombre: string, codigoInterno: string, rfc: string }>>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [isBuscandoDocente, setIsBuscandoDocente] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  // No necesitamos totalPages ya que usamos el componente Pagination
  const [individualFormData, setIndividualFormData] = useState({
    codigo_interno: '',
    nombre: '',
    rfc: '',
    materia: '',
    horas: 0,
    costo_hora: 0
  });

  // Consulta para obtener el periodo activo
  const { data: activePeriodo, isLoading: isLoadingPeriodo } = useQuery({
    queryKey: ['activePeriodo'],
    queryFn: periodosService.getActivePeriodo
  });

  // Consulta para obtener las cargas de horas
  const { data: cargasData, isLoading: isLoadingCargas, refetch: refetchCargas, error: cargasError } = useQuery({
    queryKey: ['cargasHoras', selectedArea?.id, activePeriodo?.id, currentPage, pageSize, searchQuery],
    queryFn: async () => {
      if (!selectedArea?.id || !activePeriodo?.id) {
        console.error('No hay área o periodo seleccionado');
        return { data: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 } };
      }
      try {
        const result = await cargaHorasService.getCargas(
          activePeriodo.id,
          selectedArea.id,
          currentPage,
          pageSize,
          searchQuery
        );
        return result;
      } catch (error) {
        console.error('Error en la consulta de cargas:', error);
        throw error;
      }
    },
    enabled: !!selectedArea?.id && !!activePeriodo?.id
  });

  // Mostrar error en consola si hay alguno
  useEffect(() => {
    if (cargasError) {
      console.error('Error en la consulta de cargas:', cargasError);
    }
  }, [cargasError]);

  // Ya no necesitamos actualizar totalPages ya que usamos el componente Pagination
  // que obtiene los datos directamente de cargasData.pagination

  // Función para manejar la búsqueda
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Resetear a la primera página al buscar
    refetchCargas();
  };

  // Ya no necesitamos esta función porque usamos el componente Pagination

  // Formatear importe como moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  // Mutación para eliminar una carga
  const deleteCargaMutation = useMutation({
    mutationFn: (id: number) => cargaHorasService.deleteCarga(id),
    onSuccess: () => {
      toast.success('Carga eliminada correctamente');
      setIsDeleteModalOpen(false);
      setCargaToDelete(null);
      refetchCargas();
    },
    onError: (error: any) => {
      console.error('Error al eliminar carga:', error);
      toast.error(error.response?.data?.mensaje || 'Error al eliminar la carga');
    }
  });

  // Función para abrir el modal de confirmación de eliminación
  const handleDeleteClick = (id: number) => {
    setCargaToDelete(id);
    setIsDeleteModalOpen(true);
  };

  // Función para confirmar la eliminación
  const handleConfirmDelete = () => {
    if (cargaToDelete) {
      deleteCargaMutation.mutate(cargaToDelete);
    }
  };

  // Función para descargar la plantilla
  const handleDownloadTemplate = async () => {
    if (!selectedArea) {
      toast.error('Debes seleccionar un área antes de descargar la plantilla');
      return;
    }

    if (!activePeriodo) {
      toast.error('Necesitas un periodo activo para descargar la plantilla');
      return;
    }

    // Verificar si el usuario tiene el rol COORD
    if (!hasRole('COORD')) {
      toast.error('Solo los coordinadores pueden descargar plantillas');
      return;
    }

    // Mostrar mensaje informativo
    toast.success(`Descargando plantilla para ${selectedArea.nombre} - ${activePeriodo.nombre}`);

    try {
      setIsDownloading(true);
      await cargaHorasService.descargarPlantilla(activePeriodo.id, selectedArea.id);
      toast.success('Plantilla descargada correctamente');
    } catch (error: any) {
      console.error('Error al descargar la plantilla:', error);

      // Mostrar mensaje de error específico si está disponible
      if (error.response?.data?.mensaje) {
        toast.error(error.response.data.mensaje);
      } else {
        toast.error('Error al descargar la plantilla');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // Función para manejar la selección de archivo
  const handleFileSelect = (file: File | null) => {
    setUploadedFile(file);
    setPreviewData(null); // Reiniciar la vista previa cuando se selecciona un nuevo archivo
    setIsPreviewMode(false);
  };

  // Estado para almacenar los errores por línea
  const [errores, setErrores] = useState<{ [key: number]: string }>({});

  // Función para formatear el código interno a 6 dígitos
  const formatCodigoInterno = (codigo: string | number): string => {
    // Convertir a string si es un número
    const codigoStr = String(codigo);
    // Rellenar con ceros a la izquierda hasta completar 6 dígitos
    return codigoStr.padStart(6, '0');
  };

  // Función para procesar el archivo subido
  const handleProcessFile = async () => {
    if (!uploadedFile || !selectedArea || !activePeriodo) {
      toast.error('Debes seleccionar un archivo, un área y debe haber un periodo activo');
      return;
    }

    try {
      setIsUploading(true);
      const result = await cargaHorasService.procesarArchivo(uploadedFile, activePeriodo.id, selectedArea.id);

      // Mapear errores por línea para mostrarlos en la tabla
      const erroresPorLinea: { [key: number]: string } = {};
      if (result.errores && result.errores.length > 0) {
        // Mostrar errores si hay
        toast.error(`Se encontraron ${result.errores.length} errores en el archivo`);

        // Mapear errores por línea
        result.errores.forEach(error => {
          erroresPorLinea[error.linea] = error.mensaje;
        });
      }

      // Formatear los códigos internos a 6 dígitos
      if (result.datos && result.datos.length > 0) {
        result.datos = result.datos.map(item => {
          // Crear una copia del objeto para no modificar el original
          const formattedItem = { ...item };

          // Aplicar formato de 6 dígitos al código interno
          formattedItem.codigo_interno = formatCodigoInterno(item.codigo_interno);

          // Asegurarnos de que el código interno sea un string para preservar los ceros iniciales
          if (typeof formattedItem.codigo_interno !== 'string') {
            formattedItem.codigo_interno = String(formattedItem.codigo_interno);
          }

          return formattedItem;
        });
      }

      setErrores(erroresPorLinea);
      setPreviewData(result.datos);
      setIsPreviewMode(true);
      toast.success('Archivo procesado correctamente');
    } catch (error: any) {
      console.error('Error al procesar el archivo:', error);

      if (error.response?.data?.mensaje) {
        toast.error(error.response.data.mensaje);
      } else {
        toast.error('Error al procesar el archivo');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Función para confirmar la carga
  const handleConfirmUpload = async () => {
    if (!previewData || !selectedArea || !activePeriodo) {
      toast.error('No hay datos para confirmar');
      return;
    }

    try {
      setIsUploading(true);

      // Filtrar solo las filas válidas (sin errores) y formatear
      const datosValidos = previewData
        .filter((item: any) => !item._error)
        .map((item: any) => {
          // Crear una copia del objeto sin las propiedades internas
          const { _error, _linea, ...cleanItem } = item;

          // Aplicar formato de 6 dígitos al código interno
          cleanItem.codigo_interno = formatCodigoInterno(cleanItem.codigo_interno);

          // Asegurarnos de que el código interno sea un string para preservar los ceros iniciales
          if (typeof cleanItem.codigo_interno !== 'string') {
            cleanItem.codigo_interno = String(cleanItem.codigo_interno);
          }

          return cleanItem;
        });

      const result = await cargaHorasService.confirmarCarga(datosValidos, activePeriodo.id, selectedArea.id);
      toast.success(result.mensaje || 'Carga de horas registrada correctamente');
      setUploadedFile(null);
      setPreviewData(null);
      setIsPreviewMode(false);
      setErrores({});

      // Actualizar la tabla de cargas realizadas
      refetchCargas();
    } catch (error: any) {
      console.error('Error al confirmar la carga:', error);

      if (error.response?.data?.mensaje) {
        toast.error(error.response.data.mensaje);
      } else {
        toast.error('Error al confirmar la carga');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Función para cancelar la carga
  const handleCancelUpload = () => {
    setUploadedFile(null);
    setPreviewData(null);
    setIsPreviewMode(false);
    toast.success('Carga cancelada');
  };

  // Función para abrir el modal de carga individual
  const handleOpenIndividualModal = () => {
    // Reiniciar todos los estados relacionados con el formulario
    setIndividualFormData({
      codigo_interno: '',
      nombre: '',
      rfc: '',
      materia: '',
      horas: 0,
      costo_hora: 0
    });
    setDocenteSeleccionado(false);
    setSugerenciasDocentes([]);
    setMostrarSugerencias(false);
    setIsIndividualModalOpen(true);
  };

  // Función para manejar cambios en el formulario individual
  const handleIndividualFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    // Manejar diferentes tipos de inputs
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setIndividualFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (type === 'number') {
      setIndividualFormData(prev => ({
        ...prev,
        [name]: parseFloat(value) || 0
      }));
    } else {
      setIndividualFormData(prev => ({
        ...prev,
        [name]: value
      }));

      // Si es el campo de nombre, buscar sugerencias para autocompletado
      if (name === 'nombre' && value.trim().length >= 2) {
        buscarSugerenciasDocentes(value.trim());
      } else if (name === 'nombre' && value.trim().length < 2) {
        setSugerenciasDocentes([]);
        setMostrarSugerencias(false);
      }
    }

    // Si cambia el código interno o RFC, intentar buscar el docente
    if ((name === 'codigo_interno' || name === 'rfc') && value.trim().length > 0) {
      // Esperar a que el usuario termine de escribir
      const timeoutId = setTimeout(() => {
        buscarDocente(value.trim());
      }, 500);

      return () => clearTimeout(timeoutId);
    }

    // Si se borra el código o RFC, resetear el estado de docente seleccionado
    if ((name === 'codigo_interno' || name === 'rfc') && value.trim() === '') {
      setDocenteSeleccionado(false);
    }
  };

  // Función para buscar sugerencias de docentes por nombre
  const buscarSugerenciasDocentes = async (nombre: string) => {
    if (!nombre || nombre.length < 2) return;

    try {
      setIsBuscandoDocente(true);
      const docentes = await docentesService.buscarPorNombre(nombre);
      setSugerenciasDocentes(docentes);
      setMostrarSugerencias(docentes.length > 0);
    } catch (error) {
      console.error('Error al buscar sugerencias de docentes:', error);
    } finally {
      setIsBuscandoDocente(false);
    }
  };

  // Función para seleccionar un docente de la lista de sugerencias
  const seleccionarDocente = (docente: { id: number, nombre: string, codigoInterno: string, rfc: string }) => {
    setIndividualFormData(prev => ({
      ...prev,
      codigo_interno: docente.codigoInterno,
      nombre: docente.nombre,
      rfc: docente.rfc
    }));
    setDocenteSeleccionado(true);
    setMostrarSugerencias(false);
    toast.success(`Docente seleccionado: ${docente.nombre}`);
  };

  // Función para buscar un docente por código o RFC
  const buscarDocente = async (query: string) => {
    if (!query) return;

    try {
      setIsBuscandoDocente(true);
      const docente = await docentesService.buscarPorCodigoOrfc(query);

      if (docente) {
        // Actualizar el formulario con los datos del docente
        setIndividualFormData(prev => ({
          ...prev,
          codigo_interno: docente.codigoInterno,
          nombre: docente.nombre,
          rfc: docente.rfc
        }));

        setDocenteSeleccionado(true);
        toast.success(`Docente encontrado: ${docente.nombre}`);
      } else {
        setDocenteSeleccionado(false);
      }
    } catch (error) {
      console.error('Error al buscar docente:', error);
      setDocenteSeleccionado(false);
    } finally {
      setIsBuscandoDocente(false);
    }
  };

  // Función para limpiar los datos del docente
  const limpiarDatosDocente = () => {
    setIndividualFormData(prev => ({
      ...prev,
      codigo_interno: '',
      nombre: '',
      rfc: ''
    }));
    setDocenteSeleccionado(false);
    setSugerenciasDocentes([]);
    setMostrarSugerencias(false);
  };

  // Función para guardar la carga individual
  const handleSaveIndividual = async () => {
    if (!selectedArea || !activePeriodo) {
      toast.error('Debes seleccionar un área y debe haber un periodo activo');
      return;
    }

    // Validaciones básicas
    if (!individualFormData.codigo_interno.trim()) {
      toast.error('El código interno es obligatorio');
      return;
    }

    if (!individualFormData.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    if (!individualFormData.rfc.trim()) {
      toast.error('El RFC es obligatorio');
      return;
    }

    if (!individualFormData.materia.trim()) {
      toast.error('La materia es obligatoria');
      return;
    }

    if (individualFormData.horas <= 0) {
      toast.error('Las horas deben ser mayor a 0');
      return;
    }

    if (individualFormData.costo_hora <= 0) {
      toast.error('El costo por hora debe ser mayor a 0');
      return;
    }

    try {
      setIsUploading(true);

      // Formatear el código interno y establecer pagable siempre como 1
      const formattedData = {
        ...individualFormData,
        codigo_interno: formatCodigoInterno(individualFormData.codigo_interno),
        pagable: 1 // Siempre pagable por defecto
      };

      // Llamar al servicio para procesar la carga individual
      const result = await cargaHorasService.procesarIndividual(
        formattedData as any, // Cast temporal para manejar la diferencia entre boolean y number
        activePeriodo.id,
        selectedArea.id
      );

      // Si hay datos procesados, mostrarlos en la vista previa
      if (result.datos && result.datos.length > 0) {
        // Formatear los códigos internos
        const datosFormateados = result.datos.map(item => ({
          ...item,
          codigo_interno: formatCodigoInterno(item.codigo_interno)
        }));

        setPreviewData(datosFormateados);
        setIsPreviewMode(true);
        setIsIndividualModalOpen(false);
        toast.success('Carga individual procesada correctamente');

        // Actualizar la tabla de cargas realizadas (aunque aún no se ha confirmado)
        // Esto es útil para mostrar que la carga está lista para ser confirmada
        refetchCargas();
      } else {
        toast.error('No se pudieron procesar los datos');
      }
    } catch (error: any) {
      console.error('Error al procesar la carga individual:', error);

      if (error.response?.data?.mensaje) {
        toast.error(error.response.data.mensaje);
      } else {
        toast.error('Error al procesar la carga individual');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto">
        {isLoadingPeriodo ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Cargando periodo activo...</span>
          </div>
        ) : !activePeriodo ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg shadow-md max-w-2xl">
              <div className="flex items-center mb-4">
                <FaExclamationTriangle className="text-yellow-500 text-3xl mr-4" />
                <h2 className="text-2xl font-bold text-gray-800">No hay periodo abierto</h2>
              </div>
              <p className="text-lg text-gray-700 mb-4">
                Actualmente no hay ningún periodo abierto para realizar la carga de horas.
              </p>
              <p className="text-lg text-gray-700 font-medium">
                Por favor comuníquese con el departamento de Recursos Humanos para solicitar la apertura de un periodo.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className='mb-6 flex items-center justify-between'>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Carga de Horas</h1>
              </div>

              {selectedArea && (
                <h2 className="text-3xl font-bold text-gray-800">
                  Área: <span className="font-medium text-blue-800">{selectedArea.nombre}</span>
                </h2>
              )}

              <div className="flex space-x-2">
                <Button
                  onClick={handleOpenIndividualModal}
                  disabled={!selectedArea || !activePeriodo}
                  className="flex items-center"
                  variant="secondary"
                >
                  <FaPlus className="mr-2" /> Carga Individual
                </Button>
                <Button
                  onClick={handleDownloadTemplate}
                  disabled={!selectedArea || !activePeriodo || isDownloading || !hasRole('COORD')}
                  isLoading={isDownloading}
                  className="flex items-center"
                  title={!hasRole('COORD') ? 'Solo los coordinadores pueden descargar plantillas' : ''}
                >
                  <FaDownload className="mr-2" /> Descargar Plantilla
                </Button>
              </div>
            </div>

            {!isLoadingPeriodo && (
              <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
                {isPreviewMode ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-800">Vista Previa de Datos</h3>

                    <div className="flex space-x-4 mb-4">
                      <div className="bg-green-50 p-2 rounded-md border border-green-200 flex items-center">
                        <FaCheck className="text-green-500 mr-2" />
                        <span className="text-sm font-medium">
                          {previewData ? previewData.filter((item: any) => !item._error).length : 0} registros válidos
                        </span>
                      </div>

                      {Object.keys(errores).length > 0 && (
                        <div className="bg-red-50 p-2 rounded-md border border-red-200 flex items-center">
                          <FaTimes className="text-red-500 mr-2" />
                          <span className="text-sm font-medium">
                            {Object.keys(errores).length} registros con errores
                          </span>
                        </div>
                      )}
                    </div>

                    {Object.keys(errores).length > 0 && (
                      <div className="bg-red-50 p-4 rounded-md border border-red-300 mb-4">
                        <div className="flex items-start">
                          <FaTimes className="text-red-500 mt-1 mr-3 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-red-800 mb-2">
                              Se encontraron {Object.keys(errores).length} error(es) en el archivo
                            </h4>
                            <p className="text-sm text-red-700 mb-3">
                              Las filas con errores no se pueden cargar. Por favor corrija los siguientes errores y vuelva a subir el archivo:
                            </p>
                            <ul className="space-y-1 text-sm text-red-700">
                              {Object.entries(errores).map(([linea, mensaje]) => (
                                <li key={linea} className="flex items-start">
                                  <span className="font-medium mr-2">Línea {linea}:</span>
                                  <span>{mensaje}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RFC</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Materia</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horas</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo/Hora</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData && previewData.map((item: any, index) => {
                            const tieneError = item._error;
                            
                            return (
                              <tr key={index} className={tieneError ? 'bg-red-50' : 'bg-green-50'}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{formatCodigoInterno(item.codigo_interno)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.nombre}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.rfc}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.materia}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.horas || 0}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.costo_hora || 0}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{formatCurrency((item.horas || 0) * (item.costo_hora || 0))}</td>
                                <td className="px-3 py-2 text-sm">
                                  {tieneError ? (
                                    <div className="flex items-start text-red-600">
                                      <FaTimes className="mr-1 mt-0.5 flex-shrink-0" />
                                      <span className="break-words">{tieneError}</span>
                                    </div>
                                  ) : (
                                    <span className="flex items-center text-green-600">
                                      <FaCheck className="mr-1" /> Válido
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Fila de totales */}
                        {previewData && previewData.length > 0 && (
                          <tr className="bg-gray-100 font-medium">
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700" colSpan={5}>
                              Total
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                              {/* Dejamos esta celda vacía */}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                              {formatCurrency(
                                previewData.reduce((sum: number, item: any) => {
                                  // Solo sumar si no tiene error
                                  if (!item._error) {
                                    return sum + ((item.horas || 0) * (item.costo_hora || 0));
                                  }
                                  return sum;
                                }, 0)
                              )}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        )}
                      </table>
                    </div>

                    <div className="flex space-x-2 mt-4">
                      <Button
                        onClick={handleConfirmUpload}
                        isLoading={isUploading}
                        disabled={isUploading || Object.keys(errores).length > 0}
                        className="flex items-center"
                        title={Object.keys(errores).length > 0 ? 'No se puede confirmar mientras haya errores' : ''}
                      >
                        <FaCheck className="mr-2" /> Confirmar Carga
                      </Button>
                      <Button
                        onClick={handleCancelUpload}
                        disabled={isUploading}
                        variant="outline"
                        className="flex items-center"
                      >
                        <FaTimes className="mr-2" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Cargar Plantilla</h2>
                    <p className="text-gray-600 mb-4">
                      Después de completar la plantilla, súbela aquí para registrar la carga de horas.
                    </p>

                    <FileUpload
                      onFileSelect={handleFileSelect}
                      accept=".csv,.xlsx,.xls"
                      label="Selecciona o arrastra un archivo CSV o Excel"
                    />

                    <div className="flex justify-end mt-4">
                      <Button
                        onClick={handleProcessFile}
                        disabled={!uploadedFile || !selectedArea || !activePeriodo || isUploading}
                        isLoading={isUploading}
                        className="flex items-center"
                      >
                        <FaEye className="mr-2" /> Previsualizar Datos
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabla de cargas realizadas */}
            <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Cargas Realizadas</h2>
                <form onSubmit={handleSearch} className="flex space-x-2">
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
                    <FaSearch />
                  </Button>
                </form>
              </div>

              {isLoadingCargas ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {(!cargasData || !cargasData.data || cargasData.data.length === 0) ? (
                    <div className="bg-white rounded-lg p-6 text-center">
                      <p className="text-gray-500 mb-4">No se encontraron cargas de horas para este periodo y área.</p>
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
                        columns={[
                          {
                            header: "Código",
                            accessorFn: (row: any) => row.docente.codigoInterno,
                            cell: (info: any) => info.getValue()
                          },
                          {
                            header: "Docente",
                            accessorFn: (row: any) => row.docente.nombre,
                            cell: (info: any) => info.getValue()
                          },
                          {
                            header: "Materia",
                            accessorKey: "materiaText",
                            cell: (info: any) => info.getValue()
                          },
                          {
                            header: "Horas",
                            accessorKey: "horas",
                            cell: (info: any) => info.getValue()
                          },
                          {
                            header: "Costo/Hora",
                            accessorKey: "costoHora",
                            cell: (info: any) => formatCurrency(info.getValue())
                          },
                          {
                            header: "Importe",
                            accessorFn: (row: any) => row.importe || row.horas * row.costoHora,
                            cell: (info: any) => formatCurrency(info.getValue())
                          },
                          {
                            header: "Acciones",
                            cell: (info: any) => {
                              const carga = info.row.original;
                              // Solo mostrar el botón de eliminar si el usuario actual es quien creó la carga
                              const puedeEliminar = user && carga.creadoPor && carga.creadoPor.id === user.id;
                              
                              return (
                                <div className="flex space-x-2 justify-center">
                                  {puedeEliminar ? (
                                    <button
                                      onClick={() => handleDeleteClick(carga.id)}
                                      className="text-red-500 hover:text-red-700"
                                      title="Eliminar carga"
                                    >
                                      <FaTrash />
                                    </button>
                                  ) : (
                                    <span className="text-gray-400" title="Solo puedes eliminar las cargas que tú creaste">
                                      <FaTrash />
                                    </span>
                                  )}
                                </div>
                              );
                            }
                          }
                        ]}
                        data={cargasData.data || []}
                      />

                      {/* Total de Área como fila extra de la tabla */}
                      {cargasData && cargasData.totalImporte !== undefined && (
                        <div className="mt-0 border-t-2 border-gray-300">
                          <div className="bg-blue-50 px-4 py-3 flex justify-between items-center">
                            <div className="flex items-center">
                              <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                Total de Área
                              </span>
                              <span className="ml-3 text-xs text-gray-500">
                                ({cargasData.pagination?.total || 0} registros)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-blue-700">
                                {formatCurrency(cargasData.totalImporte)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {cargasData && cargasData.pagination && (
                        <Pagination
                          currentPage={cargasData.pagination.page}
                          pageCount={cargasData.pagination.totalPages}
                          totalItems={cargasData.pagination.total}
                          pageSize={cargasData.pagination.pageSize}
                          onPageChange={(page) => {
                            setCurrentPage(page);
                          }}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Modal de confirmación para eliminar carga */}
            <Modal
              isOpen={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              title="Eliminar Carga"
            >
              <div className="space-y-4">
                <p className="text-gray-700">
                  ¿Estás seguro de que deseas eliminar esta carga? Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleConfirmDelete}
                    isLoading={deleteCargaMutation.isPending}
                  >
                    <FaTrash className="mr-2" /> Eliminar
                  </Button>
                </div>
              </div>
            </Modal>

            {/* Modal para carga individual */}
            <Modal
              isOpen={isIndividualModalOpen}
              onClose={() => setIsIndividualModalOpen(false)}
              title="Carga Individual de Horas"
            >
              <div className="space-y-4">
                <div className="relative mb-4">
                  <Input
                    label="Nombre Completo"
                    name="nombre"
                    value={individualFormData.nombre}
                    onChange={handleIndividualFormChange}
                    placeholder="Buscar docente por nombre..."
                    required
                    className={isBuscandoDocente ? "pr-10" : ""}
                  />
                  {isBuscandoDocente && (
                    <div className="absolute right-3 top-9">
                      <div className="animate-spin h-4 w-4 border-t-2 border-blue-500 rounded-full"></div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Escribe para buscar docentes</p>

                  {/* Lista de sugerencias */}
                  {mostrarSugerencias && sugerenciasDocentes.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {sugerenciasDocentes.map(docente => (
                        <div
                          key={docente.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                          onClick={() => seleccionarDocente(docente)}
                        >
                          <div>
                            <div className="font-medium">{docente.nombre}</div>
                            <div className="text-xs text-gray-500">{docente.rfc}</div>
                          </div>
                          <div className="text-xs bg-gray-200 px-2 py-1 rounded">{docente.codigoInterno}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Input
                      label="Código Interno"
                      name="codigo_interno"
                      value={individualFormData.codigo_interno}
                      onChange={handleIndividualFormChange}
                      placeholder="Ej: 123456"
                      required
                      className={isBuscandoDocente ? "pr-10" : ""}
                      disabled={true}
                    />
                    {isBuscandoDocente && (
                      <div className="absolute right-3 top-9">
                        <div className="animate-spin h-4 w-4 border-t-2 border-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      label="RFC"
                      name="rfc"
                      value={individualFormData.rfc}
                      onChange={handleIndividualFormChange}
                      placeholder="Ej: XAXX010101000"
                      required
                      className={isBuscandoDocente ? "pr-10" : ""}
                      disabled={true}
                    />
                    {isBuscandoDocente && (
                      <div className="absolute right-3 top-9">
                        <div className="animate-spin h-4 w-4 border-t-2 border-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                {docenteSeleccionado && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={limpiarDatosDocente}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Cambiar docente
                    </button>
                  </div>
                )}

                <Input
                  label="Materia"
                  name="materia"
                  value={individualFormData.materia}
                  onChange={handleIndividualFormChange}
                  placeholder="Nombre de la materia"
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Horas"
                    name="horas"
                    type="number"
                    value={individualFormData.horas}
                    onChange={handleIndividualFormChange}
                    min="0.01"
                    step="0.01"
                    required
                  />
                  <Input
                    label="Costo por Hora"
                    name="costo_hora"
                    type="number"
                    value={individualFormData.costo_hora}
                    onChange={handleIndividualFormChange}
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>


                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsIndividualModalOpen(false)}
                    disabled={isUploading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveIndividual}
                    isLoading={isUploading}
                    disabled={isUploading}
                  >
                    <FaCheck className="mr-2" /> Guardar
                  </Button>
                </div>
              </div>
            </Modal>
          </>
        )}

      </div>
    </MainLayout>
  );
};
