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
  getAll: async (query = '', page = 1, pageSize = 10): Promise<DocentePaginado> => {
    const response = await api.get('/docentes', {
      params: { query, page, pageSize }
    });
    return response.data;
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
  downloadTemplate: () => {
    // Crear un archivo CSV con las columnas requeridas y un ejemplo
    const headers = ['codigo_interno', 'nombre', 'rfc', 'activo'];
    const exampleRow = ['DOC001', 'Juan Pérez García', 'PEGJ800101ABC', 'true'];
    
    // Crear el contenido del CSV con encabezados y ejemplo
    let csvContent = headers.join(',') + '\n' + exampleRow.join(',');
    
    // Añadir BOM para que Excel reconozca correctamente los caracteres UTF-8
    const BOM = '\uFEFF';
    csvContent = BOM + csvContent;
    
    // Crear un blob con el contenido CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Crear un enlace para descargar el archivo
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_docentes.csv');
    link.style.visibility = 'hidden';
    
    // Añadir el enlace al DOM, hacer clic en él y luego eliminarlo
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Liberar el objeto URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  },
};
