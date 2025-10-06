import api from './api';

export interface CargaHorasTemplate {
  codigo_interno: string;
  nombre: string;
  rfc: string;
  materia: string;
  horas: number;
  costo_hora: number;
  pagable: number; // 0 o 1
}

export interface CargaHorasPreview {
  datos: CargaHorasTemplate[];
  errores?: {
    linea: number;
    mensaje: string;
  }[];
}

export interface CargaHorasResult {
  registrados: number;
  errores: number;
  mensaje: string;
}

export const cargaHorasService = {
  /**
   * Descarga la plantilla para carga de horas
   * @param periodoId ID del periodo (debe estar ABIERTO)
   * @param areaId ID del área (el usuario debe ser coordinador)
   * @returns URL del archivo para descarga
   */
  descargarPlantilla: async (periodoId: number, areaId: number): Promise<void> => {
    try {
      // Hacer la solicitud para descargar el archivo
      const response = await api.get(`/carga-horas/plantillas`, {
        params: { periodoId, areaId },
        responseType: 'blob', // Importante para recibir un archivo binario
      });

      // Crear un objeto URL para el blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      
      // Crear un elemento <a> temporal
      const link = document.createElement('a');
      link.href = url;
      
      // Obtener el nombre del archivo del header Content-Disposition o usar uno predeterminado
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'plantilla_carga_horas.xlsx';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      
      // Agregar el enlace al DOM, hacer clic en él y luego eliminarlo
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Liberar el objeto URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar la plantilla:', error);
      throw error;
    }
  },

  /**
   * Procesa un archivo de carga de horas para obtener una vista previa
   * @param file Archivo a procesar
   * @param periodoId ID del periodo
   * @param areaId ID del área
   * @returns Datos procesados para vista previa
   */
  procesarArchivo: async (file: File, periodoId: number, areaId: number): Promise<CargaHorasPreview> => {
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('periodoId', periodoId.toString());
      formData.append('areaId', areaId.toString());

      const response = await api.post('/carga-horas/procesar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error al procesar el archivo:', error);
      throw error;
    }
  },

  /**
   * Confirma la carga de horas
   * @param datos Datos a guardar
   * @param periodoId ID del periodo
   * @param areaId ID del área
   * @returns Resultado de la operación
   */
  confirmarCarga: async (datos: CargaHorasTemplate[], periodoId: number, areaId: number): Promise<CargaHorasResult> => {
    try {
      const response = await api.post('/carga-horas/confirmar', {
        datos,
        periodoId,
        areaId,
      });

      return response.data;
    } catch (error) {
      console.error('Error al confirmar la carga:', error);
      throw error;
    }
  },
};
