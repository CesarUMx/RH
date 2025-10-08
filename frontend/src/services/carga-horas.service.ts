import api from './api';

export interface CargaHorasTemplate {
  codigo_interno: string; // Siempre debe ser string para preservar los ceros iniciales
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

export interface CargaHora {
  id: number;
  docenteId: number;
  periodoId: number;
  areaId: number;
  materiaText: string;
  horas: number;
  costoHora: number;
  pagable: boolean;
  importe: number;
  docente: {
    id: number;
    codigoInterno: string;
    nombre: string;
    rfc: string;
  };
  createdAt: string;
}

export interface CargaHorasPaginadas {
  data: CargaHora[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
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

  /**
   * Procesa una carga individual de horas
   * @param dato Datos del registro individual
   * @param periodoId ID del periodo
   * @param areaId ID del área
   * @returns Vista previa del registro procesado
   */
  procesarIndividual: async (dato: CargaHorasTemplate, periodoId: number, areaId: number): Promise<CargaHorasPreview> => {
    try {
      // Asegurarse de que el código interno tenga 6 dígitos
      const codigoStr = String(dato.codigo_interno).trim();
      const codigoFormateado = codigoStr.padStart(6, '0');
      
      // Crear una copia con el código formateado
      const datoFormateado = {
        ...dato,
        codigo_interno: codigoFormateado
      };

      console.log('Enviando datos para carga individual:', {
        dato: datoFormateado,
        periodoId,
        areaId
      });

      // Enviar al servidor para validación
      const response = await api.post('/carga-horas/procesar-individual', {
        dato: datoFormateado,
        periodoId,
        areaId,
      });

      console.log('Respuesta del servidor:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error al procesar la carga individual:', error);
      throw error;
    }
  },

  /**
   * Obtiene las cargas de horas registradas
   * @param periodoId ID del periodo
   * @param areaId ID del área
   * @param page Número de página
   * @param pageSize Tamaño de página
   * @param query Consulta de búsqueda (opcional)
   * @returns Lista paginada de cargas de horas
   */
  getCargas: async (periodoId: number, areaId: number, page = 1, pageSize = 10, query = ''): Promise<CargaHorasPaginadas> => {
    try {
      console.log('Llamando a API con parámetros:', { periodoId, areaId, page, pageSize, query });
      
      const response = await api.get('/carga-horas', {
        params: {
          periodoId,
          areaId,
          page,
          pageSize,
          query
        }
      });

      console.log('Respuesta de API:', response.status, response.statusText);
      console.log('Datos recibidos:', response.data);
      
      return response.data;
    } catch (error: any) {
      console.error('Error al obtener cargas de horas:', error);
      console.error('Detalles del error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Devolver un objeto vacío con estructura válida en caso de error
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      };
    }
  },

  /**
   * Elimina una carga de horas
   * @param id ID de la carga de horas a eliminar
   * @returns Mensaje de confirmación
   */
  deleteCarga: async (id: number): Promise<{ mensaje: string }> => {
    try {
      const response = await api.delete(`/carga-horas/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error al eliminar carga de horas:', error);
      throw error;
    }
  },
};
