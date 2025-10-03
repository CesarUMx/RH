import api from './api';

export type EstadoPeriodo = 'BORRADOR' | 'ABIERTO' | 'CERRADO' | 'REPORTADO';

export const EstadoPeriodo = {
  BORRADOR: 'BORRADOR' as EstadoPeriodo,
  ABIERTO: 'ABIERTO' as EstadoPeriodo,
  CERRADO: 'CERRADO' as EstadoPeriodo,
  REPORTADO: 'REPORTADO' as EstadoPeriodo
};

export interface Periodo {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodo;
}

export interface CreatePeriodoDto {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

export const periodosService = {
  getAll: async (): Promise<Periodo[]> => {
    const response = await api.get('/periodos');
    return response.data;
  },

  getActivePeriodo: async (): Promise<Periodo | null> => {
    const periodos = await periodosService.getAll();
    return periodos.find(p => p.estado === EstadoPeriodo.ABIERTO) || null;
  },

  create: async (periodo: CreatePeriodoDto): Promise<Periodo> => {
    const response = await api.post('/periodos', periodo);
    return response.data;
  },

  abrir: async (id: number): Promise<Periodo> => {
    const response = await api.patch(`/periodos/${id}/abrir`);
    return response.data;
  },

  cerrar: async (id: number): Promise<Periodo> => {
    const response = await api.patch(`/periodos/${id}/cerrar`);
    return response.data;
  },

  reportar: async (id: number): Promise<Periodo> => {
    const response = await api.patch(`/periodos/${id}/reportar`);
    return response.data;
  },
};
