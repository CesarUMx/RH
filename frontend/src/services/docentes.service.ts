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

export const docentesService = {
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
    
    console.log('Sending API request with params:', params);
    
    try {
      const response = await api.get('/docentes', { params });
      console.log('API response status:', response.status);
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

  create: async (docente: CreateDocenteDto): Promise<Docente> => {
    const response = await api.post('/docentes', docente);
    return response.data;
  },

  update: async (id: number, docente: UpdateDocenteDto): Promise<Docente> => {
    const response = await api.put(`/docentes/${id}`, docente);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/docentes/${id}`);
  },

  import: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/docentes/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
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
