import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaDownload, FaFileExcel, FaFileArchive } from 'react-icons/fa';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { gestionPagosService } from '../../services/gestion-pagos.service';
import type { FormatoDescarga } from '../../services/gestion-pagos.service';

interface DescargaReportesAreaProps {
  periodoId: number;
  periodoNombre?: string;
}

export const DescargaReportesArea = ({ periodoId, periodoNombre }: DescargaReportesAreaProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formato, setFormato] = useState<FormatoDescarga>('excel_multihojas');

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      toast.loading('Generando reportes por área...');
      
      const blob = await gestionPagosService.exportReportesPorArea(periodoId, formato);
      
      // Crear URL para el blob
      const url = window.URL.createObjectURL(blob);
      
      // Crear elemento <a> para la descarga
      const a = document.createElement('a');
      a.href = url;
      
      // Nombre del archivo según el formato
      const extension = formato === 'zip' ? 'zip' : 'xlsx';
      const periodoInfo = periodoNombre ? `-${periodoNombre}` : '';
      a.download = `reportes-por-area${periodoInfo}.${extension}`;
      
      // Simular clic para iniciar la descarga
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss();
      toast.success(`Reportes por área descargados en formato ${formato === 'zip' ? 'ZIP' : 'Excel'}`);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error al descargar reportes por área:', error);
      toast.dismiss();
      toast.error('Error al descargar los reportes por área');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        variant="secondary"
        className="flex items-center"
        title="Descargar reportes por área"
      >
        <FaDownload className="mr-2" /> Reportes por Área
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !isLoading && setIsModalOpen(false)}
        title="Descargar Reportes por Área"
        size="md"
      >
        <div className="space-y-6">
          <p className="text-gray-700">
            Seleccione el formato en el que desea descargar los reportes de carga de horas por área:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`border rounded-lg p-4 cursor-pointer flex flex-col items-center ${
                formato === 'excel_multihojas' ? 'border-primary bg-blue-50' : 'border-gray-200'
              }`}
              onClick={() => setFormato('excel_multihojas')}
            >
              <FaFileExcel className="text-green-600 text-4xl mb-2" />
              <h3 className="font-medium">Excel con múltiples hojas</h3>
              <p className="text-sm text-gray-500 text-center mt-2">
                Un solo archivo Excel con cada área en una hoja diferente
              </p>
            </div>

            <div
              className={`border rounded-lg p-4 cursor-pointer flex flex-col items-center ${
                formato === 'zip' ? 'border-primary bg-blue-50' : 'border-gray-200'
              }`}
              onClick={() => setFormato('zip')}
            >
              <FaFileArchive className="text-blue-600 text-4xl mb-2" />
              <h3 className="font-medium">Archivos separados (ZIP)</h3>
              <p className="text-sm text-gray-500 text-center mt-2">
                Archivo comprimido ZIP con un Excel por cada área
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDownload}
              isLoading={isLoading}
            >
              Descargar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
