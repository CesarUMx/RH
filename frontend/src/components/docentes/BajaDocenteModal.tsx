import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { solicitudesBajaService } from '../../services/solicitudesBaja.service';
import type { Docente } from '../../services/docentes.service';

interface BajaDocenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  docente: Docente | null;
  onSuccess: () => void;
}

export const BajaDocenteModal: React.FC<BajaDocenteModalProps> = ({
  isOpen,
  onClose,
  docente,
  onSuccess
}) => {
  const [motivoBaja, setMotivoBaja] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!docente) {
      toast.error('No se ha seleccionado un docente');
      return;
    }

    if (!motivoBaja.trim()) {
      toast.error('Debe proporcionar un motivo de baja');
      return;
    }

    try {
      setEnviando(true);
      
      await solicitudesBajaService.crearSolicitudBaja({
        docenteId: docente.id,
        motivoBaja: motivoBaja.trim()
      });
      
      toast.success('Solicitud de baja enviada correctamente');
      setMotivoBaja('');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al solicitar baja:', error);
      toast.error(error.response?.data?.error || 'Error al solicitar la baja del docente');
    } finally {
      setEnviando(false);
    }
  };

  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 md:mx-0">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            Solicitar Baja de Docente
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Importante:</strong> Al solicitar la baja, el docente será marcado como inactivo inmediatamente y se enviará una notificación a Recursos Humanos.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                <strong>Docente:</strong> {docente?.nombre}
              </p>
              <p className="text-gray-700 mb-2">
                <strong>Código:</strong> {docente?.codigoInterno}
              </p>
            </div>

            <label htmlFor="motivoBaja" className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de Baja <span className="text-red-500">*</span>
            </label>
            <textarea
              id="motivoBaja"
              value={motivoBaja}
              onChange={(e) => setMotivoBaja(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              rows={4}
              placeholder="Describa el motivo de la baja del docente..."
              required
            />
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
              disabled={enviando}
            >
              {enviando ? 'Enviando...' : 'Solicitar Baja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
