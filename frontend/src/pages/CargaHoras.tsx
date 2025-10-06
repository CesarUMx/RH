import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaDownload, FaEye, FaCheck, FaTimes } from 'react-icons/fa';

import { MainLayout } from '../layouts/MainLayout';
import { Button } from '../components/ui/Button';
import { FileUpload } from '../components/ui/FileUpload';
import { useArea } from '../context/AreaContext';
import { useAuth } from '../context/AuthContext';
import { periodosService } from '../services/periodos.service';
import { cargaHorasService } from '../services/carga-horas.service';

export const CargaHoras = () => {
  const { selectedArea } = useArea();
  const { hasRole } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Consulta para obtener el periodo activo
  const { data: activePeriodo, isLoading: isLoadingPeriodo } = useQuery({
    queryKey: ['activePeriodo'],
    queryFn: periodosService.getActivePeriodo
  });

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
      const result = await cargaHorasService.confirmarCarga(previewData, activePeriodo.id, selectedArea.id);
      toast.success(result.mensaje || 'Carga de horas registrada correctamente');
      setUploadedFile(null);
      setPreviewData(null);
      setIsPreviewMode(false);
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

  return (
    <MainLayout>
      <div className="container mx-auto">
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Carga de Horas</h1>
            {selectedArea && (
              <p className="text-gray-600 mt-1">
                Área: <span className="font-medium">{selectedArea.nombre}</span>
              </p>
            )}
          </div>

          <div>
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

        <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
          {isPreviewMode ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800">Vista Previa de Datos</h3>

              <div className="flex space-x-4 mb-4">
                <div className="bg-green-50 p-2 rounded-md border border-green-200 flex items-center">
                  <FaCheck className="text-green-500 mr-2" />
                  <span className="text-sm font-medium">
                    {previewData ? previewData.length - Object.keys(errores).length : 0} registros válidos
                  </span>
                </div>

                <div className="bg-red-50 p-2 rounded-md border border-red-200 flex items-center">
                  <FaTimes className="text-red-500 mr-2" />
                  <span className="text-sm font-medium">
                    {Object.keys(errores).length} registros con errores
                  </span>
                </div>
              </div>

              {Object.keys(errores).length > 0 && (
                <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Atención:</strong> Se encontraron errores en algunos registros.
                    Debe corregir estos errores en el archivo y volver a subirlo para poder confirmar la carga.
                  </p>
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pagable</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData && previewData.map((item, index) => {
                      // Verificar si esta fila tiene un error
                      const tieneError = errores[index + 2]; // +2 porque Excel empieza en 1 y hay encabezado

                      return (
                        <tr key={index} className={tieneError ? 'bg-red-50' : 'bg-green-50'}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.codigo_interno}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.nombre}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.rfc}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.materia}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.horas}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${item.costo_hora}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {item.pagable ? (
                              <FaCheck className="text-green-500" />
                            ) : (
                              <FaTimes className="text-red-500" />
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {tieneError ? (
                              <span className="flex items-center text-red-500">
                                <FaTimes className="mr-1" /> {tieneError}
                              </span>
                            ) : (
                              <span className="flex items-center text-green-500">
                                <FaCheck className="mr-1" /> Correcto
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
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
      </div>
    </MainLayout>
  );
};
