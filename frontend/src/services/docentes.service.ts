import api from './api';

export interface Docente {
  id: number;
  codigoInterno: string;
  nombre: string;
  rfc: string;
  activo: boolean;
}

export interface DocentePaginado {
  data: Docente[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface CreateDocenteDto {
  codigoInterno: string;
  nombre: string;
  rfc: string;
  activo?: boolean;
}

export interface UpdateDocenteDto {
  codigoInterno?: string;
  nombre?: string;
  rfc?: string;
  activo?: boolean;
}

export interface ImportResult {
  total: number;
  insertados: number;
  actualizados: number;
  errores: {
    linea: number;
    codigoInterno: string;
    rfc: string;
    error: string;
  }[];
  erroresArchivo?: string;
}

// Función para formatear el código interno a 6 dígitos
const formatCodigoInterno = (codigo: string | number): string => {
  // Convertir a string si es un número
  const codigoStr = String(codigo);
  // Rellenar con ceros a la izquierda hasta completar 6 dígitos
  return codigoStr.padStart(6, '0');
};

export const docentesService = {
  formatCodigoInterno,
  
  getAll: async (query = '', page = 1, pageSize = 10, areaId?: number): Promise<DocentePaginado> => {
    // Asegurarse de que page sea un número válido
    const validPage = isNaN(Number(page)) || Number(page) < 1 ? 1 : Number(page);
    
    // Construir parámetros de consulta
    const params = { 
      query, 
      page: validPage, 
      pageSize
    };
    
    // Añadir areaId solo si es un número válido
    if (areaId !== undefined && !isNaN(Number(areaId))) {
      Object.assign(params, { areaId: Number(areaId) });
    }
    
    try {
      const response = await api.get('/docentes', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching docentes:', error);
      // Devolver un objeto vacío con estructura válida en caso de error
      return {
        data: [],
        pagination: {
          total: 0,
          page: validPage,
          pageSize,
          totalPages: 0
        }
      };
    }
  },

  getById: async (id: number): Promise<Docente> => {
    const response = await api.get(`/docentes/${id}`);
    return response.data;
  },

  /**
   * Busca un docente por código interno o RFC
   * @param query Código interno o RFC a buscar
   * @returns Docente encontrado o null
   */
  buscarPorCodigoOrfc: async (query: string): Promise<Docente | null> => {
    try {
      // Formatear el código si parece ser un código interno (solo números)
      const isCodigoInterno = /^\d+$/.test(query.trim());
      let searchQuery = query.trim();
      
      if (isCodigoInterno) {
        // Formatear a 6 dígitos si parece ser un código interno
        searchQuery = formatCodigoInterno(searchQuery);
      }

      const response = await api.get('/docentes/buscar', {
        params: { query: searchQuery }
      });

      if (response.data && response.data.id) {
        // Asegurarse de que el código interno esté formateado
        return {
          ...response.data,
          codigoInterno: formatCodigoInterno(response.data.codigoInterno)
        };
      }
      return null;
    } catch (error) {
      console.error('Error buscando docente:', error);
      return null;
    }
  },

  /**
   * Busca docentes por nombre para autocompletado
   * @param nombre Nombre o parte del nombre a buscar
   * @returns Lista de docentes que coinciden con el nombre
   */
  buscarPorNombre: async (nombre: string): Promise<Docente[]> => {
    try {
      if (!nombre || nombre.trim().length < 2) {
        return [];
      }

      const response = await api.get('/docentes', {
        params: { 
          query: nombre.trim(),
          page: 1,
          pageSize: 10
        }
      });

      if (response.data && response.data.data) {
        // Formatear los códigos internos de todos los docentes
        return response.data.data.map((docente: Docente) => ({
          ...docente,
          codigoInterno: formatCodigoInterno(docente.codigoInterno)
        }));
      }
      return [];
    } catch (error) {
      console.error('Error buscando docentes por nombre:', error);
      return [];
    }
  },

  create: async (docente: CreateDocenteDto): Promise<Docente> => {
    // Formatear el código interno a 6 dígitos
    const formattedDocente = {
      ...docente,
      codigoInterno: formatCodigoInterno(docente.codigoInterno)
    };
    
    const response = await api.post('/docentes', formattedDocente);
    return response.data;
  },

  update: async (id: number, docente: UpdateDocenteDto): Promise<Docente> => {
    // Si hay código interno, formatearlo a 6 dígitos
    const formattedDocente = { ...docente };
    if (formattedDocente.codigoInterno) {
      formattedDocente.codigoInterno = formatCodigoInterno(formattedDocente.codigoInterno);
    }
    
    const response = await api.put(`/docentes/${id}`, formattedDocente);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/docentes/${id}`);
  },


  import: async (file: File): Promise<ImportResult> => {
    try {
      // Crear un FormData para enviar el archivo
      const formData = new FormData();
      
      // Agregar un mensaje para indicar que se deben formatear los códigos internos
      formData.append('formatearCodigos', 'true');
      
      // Obtener una copia del archivo original para poder modificarlo si es necesario
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      // Si es un archivo CSV, podemos procesarlo directamente
      if (fileExt === 'csv') {
        // Leer el contenido del archivo
        const fileContent = await file.text();
        const lines = fileContent.split('\n');
        
        // Procesar cada línea para formatear los códigos internos
        const processedLines = lines.map((line, index) => {
          // Si es la primera línea (encabezados), no la modificamos
          if (index === 0) return line;
          
          const columns = line.split(',');
          // Si la línea tiene al menos una columna (código interno)
          if (columns.length > 0 && columns[0]) {
            // Formatear el código interno a 6 dígitos
            columns[0] = formatCodigoInterno(columns[0].trim().replace(/["']/g, ''));
            return columns.join(',');
          }
          return line;
        });
        
        // Crear un nuevo archivo con el contenido procesado
        const processedContent = processedLines.join('\n');
        const processedFile = new File([processedContent], file.name, { type: file.type });
        formData.append('file', processedFile);
      } else {
        // Para archivos Excel, no podemos procesarlos en el frontend fácilmente
        // Así que enviamos el archivo original y confiamos en el backend
        formData.append('file', file);
      }
      
      // Enviar el archivo al servidor
      const response = await api.post('/docentes/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error al importar docentes:', error);
      throw error;
    }
  },

  // Función para descargar la plantilla de carga masiva
  downloadTemplate: async (): Promise<void> => {
    try {
      // Hacer una solicitud a la API para obtener la plantilla
      const response = await api.get('/docentes/plantilla', {
        responseType: 'blob', // Importante para recibir un archivo binario
      });
      
      // Crear un objeto URL para el blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      
      // Crear un elemento <a> temporal
      const link = document.createElement('a');
      link.href = url;
      
      // Obtener el nombre del archivo del header Content-Disposition o usar uno predeterminado
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'plantilla_docentes.xlsx';
      
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
};
