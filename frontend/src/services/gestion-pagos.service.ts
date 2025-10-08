import api from './api';

export interface ReportePagosPaginado {
  data: any[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export const gestionPagosService = {
  /**
   * Obtiene las áreas disponibles
   * @returns Lista de áreas
   */
  getAreas: async () => {
    try {
      const response = await api.get('/areas');
      return response.data;
    } catch (error) {
      console.error('Error al obtener áreas:', error);
      return [];
    }
  },

  /**
   * Obtiene el reporte de pagos
   * @param periodoId ID del periodo
   * @param areaId ID del área (opcional)
   * @param tipo Tipo de reporte: 'general', 'area' o 'docente'
   * @param page Número de página
   * @param pageSize Tamaño de página
   * @param query Consulta de búsqueda (opcional)
   * @returns Reporte de pagos paginado
   */
  getReportePagos: async (
    periodoId: number,
    areaId?: number,
    tipo: 'general' | 'area' | 'docente' = 'general',
    page = 1,
    pageSize = 10,
    query = ''
  ): Promise<ReportePagosPaginado> => {
    try {
      const response = await api.get('/pagos/reporte', {
        params: {
          periodoId,
          areaId,
          tipo,
          page,
          pageSize,
          query
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error al obtener reporte de pagos:', error);
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
   * Cierra un periodo
   * @param periodoId ID del periodo a cerrar
   * @returns Mensaje de confirmación
   */
  closePeriod: async (periodoId: number): Promise<{ mensaje: string }> => {
    try {
      // Usamos patch en lugar de post para coincidir con el servicio de periodos
      const response = await api.patch(`/periodos/${periodoId}/cerrar`);
      return response.data;
    } catch (error) {
      console.error('Error al cerrar periodo:', error);
      throw error;
    }
  },

  /**
   * Actualiza una carga de horas
   * @param cargaId ID de la carga a actualizar
   * @param data Datos a actualizar
   * @returns Mensaje de confirmación
   */
  updateCarga: async (cargaId: number, data: any): Promise<{ mensaje: string }> => {
    try {
      const response = await api.put(`/carga-horas/${cargaId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error al actualizar carga:', error);
      throw error;
    }
  },

  // La función exportReportePDF ha sido eliminada ya que solo se requiere exportación a Excel

  /**
   * Exporta el reporte de pagos a Excel con formato especial
   * @param periodoId ID del periodo
   * @returns Blob con el archivo Excel
   */
  exportReporteExcel: async (periodoId: number): Promise<Blob> => {
    try {
      const response = await api.get('/pagos/exportar/excel', {
        params: {
          periodoId
        },
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      console.error('Error al exportar reporte a Excel:', error);
      throw error;
    }
  }
};
