import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaUpload, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { solicitudesService } from '../../services/solicitudes.service';

interface AltaDocenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DocumentoInfo {
  key: 'constanciaFiscal' | 'comprobanteDomicilio' | 'cv' | 'cuentaBancaria' | 'ine';
  nombre: string;
  archivo: File | null;
  subiendo: boolean;
  error: string | null;
  completado: boolean;
}

export const AltaDocenteModal = ({ isOpen, onClose, onSuccess }: AltaDocenteModalProps) => {
  const initialDocumentos: DocumentoInfo[] = [
    { key: 'constanciaFiscal', nombre: 'Constancia de Situación Fiscal (actualizada, mínimo 2 meses)', archivo: null, subiendo: false, error: null, completado: false },
    { key: 'comprobanteDomicilio', nombre: 'Comprobante de Domicilio (actualizado, mínimo 2 meses)', archivo: null, subiendo: false, error: null, completado: false },
    { key: 'cv', nombre: 'Curriculum Vitae', archivo: null, subiendo: false, error: null, completado: false },
    { key: 'cuentaBancaria', nombre: 'Cuenta Bancaria (Carátula con número de cuenta visible)', archivo: null, subiendo: false, error: null, completado: false },
    { key: 'ine', nombre: 'INE', archivo: null, subiendo: false, error: null, completado: false },
  ];
  
  const [documentos, setDocumentos] = useState<DocumentoInfo[]>(initialDocumentos);
  const [enviando, setEnviando] = useState(false);
  const [nombre, setNombre] = useState('');

  // Manejar cambio de archivo
  const handleFileChange = (index: number, file: File | null) => {
    setDocumentos(prev => {
      const nuevosDocumentos = [...prev];
      nuevosDocumentos[index] = {
        ...nuevosDocumentos[index],
        archivo: file,
        error: null
      };
      return nuevosDocumentos;
    });
  };

  // Validar archivo
  const validarArchivo = (file: File): { valido: boolean; mensaje?: string } => {
    // Verificar tipo de archivo (PDF)
    if (file.type !== 'application/pdf') {
      return { valido: false, mensaje: 'Solo se permiten archivos PDF.' };
    }
    
    // Verificar tamaño (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB en bytes
    if (file.size > maxSize) {
      return { valido: false, mensaje: 'El archivo no debe exceder 10MB.' };
    }
    
    return { valido: true };
  };

  // Resetear el formulario
  const resetearFormulario = () => {
    setNombre('');
    setDocumentos(JSON.parse(JSON.stringify(initialDocumentos))); // Copia profunda para resetear completamente
    setEnviando(false);
  };

  // Efecto para resetear el formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      // Dar tiempo para que se complete la animación de cierre
      setTimeout(() => {
        resetearFormulario();
      }, 300);
    }
  }, [isOpen]);

  // Enviar solicitud de alta
  const handleSubmit = async () => {
    // Validar que se haya proporcionado un nombre
    if (!nombre.trim()) {
      toast.error('Debe proporcionar el nombre del docente');
      return;
    }

    // Validar que todos los documentos estén seleccionados
    const faltanDocumentos = documentos.some(doc => !doc.archivo);
    if (faltanDocumentos) {
      toast.error('Debe subir todos los documentos requeridos');
      return;
    }

    try {
      setEnviando(true);
      
      // Crear solicitud de alta
      const solicitud = await solicitudesService.crearSolicitudAlta({
        nombre
      });
      
      // Subir cada documento
      let todosExitosos = true;
      
      for (let i = 0; i < documentos.length; i++) {
        const doc = documentos[i];
        if (!doc.archivo) continue;
        
        try {
          setDocumentos(prev => {
            const nuevos = [...prev];
            nuevos[i].subiendo = true;
            return nuevos;
          });
          
          await solicitudesService.subirDocumentoSolicitud(
            solicitud.id,
            doc.key,
            doc.archivo
          );
          
          setDocumentos(prev => {
            const nuevos = [...prev];
            nuevos[i].subiendo = false;
            nuevos[i].completado = true;
            return nuevos;
          });
        } catch (error) {
          console.error(`Error al subir ${doc.nombre}:`, error);
          setDocumentos(prev => {
            const nuevos = [...prev];
            nuevos[i].subiendo = false;
            nuevos[i].error = 'Error al subir el documento';
            return nuevos;
          });
          toast.error(`Error al subir ${doc.nombre}`);
          todosExitosos = false;
        }
      }
      
      if (todosExitosos) {
        toast.success('Solicitud de alta enviada correctamente');
        onSuccess();
        onClose();
        resetearFormulario();
      } else {
        toast.error('Hubo errores al subir algunos documentos. Por favor, intente nuevamente.');
        // No cerramos el modal para que pueda corregir los errores
      }
    } catch (error) {
      console.error('Error al crear solicitud de alta:', error);
      toast.error('Error al crear solicitud de alta');
      resetearFormulario();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Alta de Docente"
      size="lg"
    >
      <div className="space-y-6">
        <p className="text-gray-700">
          Complete el formulario y suba los documentos requeridos para solicitar el alta de un nuevo docente.
        </p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Docente (requerido)
            </label>
            <input
              type="text"
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="Nombre completo del docente"
            />
          </div>
          
          {/* Campo de correo eliminado */}
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <h4 className="text-sm font-medium text-blue-800">Información importante</h4>
            <ul className="mt-2 text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>La <strong>Constancia de Situación Fiscal</strong> debe estar <strong>actualizada (mínimo 2 meses)</strong>.</li>
              <li>El <strong>Comprobante de Domicilio</strong> debe estar <strong>actualizado (mínimo 2 meses)</strong>.</li>
              <li>La <strong>Carátula Bancaria</strong> debe incluir el <strong>número de cuenta</strong>, de lo contrario no procederá el alta.</li>
              <li>Si la documentación no cumple con estos requisitos, la solicitud será rechazada.</li>
            </ul>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Documentos Requeridos (PDF)</h3>
          
          {documentos.map((doc, index) => (
            <div key={doc.key} className="border rounded-md p-4">
              <div className="flex justify-between items-center">
                <label htmlFor={`doc-${doc.key}`} className="block text-sm font-medium text-gray-700">
                  {doc.nombre}
                </label>
                
                <div className="flex items-center space-x-2">
                  {doc.completado ? (
                    <span className="text-green-500 flex items-center">
                      <FaCheck className="mr-1" /> Subido
                    </span>
                  ) : doc.error ? (
                    <span className="text-red-500 flex items-center">
                      <FaExclamationTriangle className="mr-1" /> Error
                    </span>
                  ) : doc.subiendo ? (
                    <span className="text-blue-500">Subiendo...</span>
                  ) : null}
                  
                  <input
                    type="file"
                    id={`doc-${doc.key}`}
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        const validacion = validarArchivo(file);
                        if (!validacion.valido) {
                          toast.error(validacion.mensaje || 'Archivo inválido');
                          return;
                        }
                      }
                      handleFileChange(index, file);
                    }}
                    className="hidden"
                    disabled={doc.subiendo || enviando}
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById(`doc-${doc.key}`)?.click()}
                    disabled={doc.subiendo || enviando}
                  >
                    <FaUpload className="mr-1" />
                    {doc.archivo ? 'Cambiar' : 'Seleccionar'}
                  </Button>
                </div>
              </div>
              
              {doc.archivo && !doc.completado && !doc.error && (
                <div className="mt-2 text-sm text-gray-500">
                  Archivo seleccionado: {doc.archivo.name}
                </div>
              )}
              
              {doc.error && (
                <div className="mt-2 text-sm text-red-500">
                  {doc.error}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={enviando}
          >
            Cancelar
          </Button>
          
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={enviando || !nombre.trim() || documentos.some(doc => !doc.archivo)}
            isLoading={enviando}
          >
            Enviar Solicitud
          </Button>
        </div>
      </div>
    </Modal>
  );
};
