export type InsightsBranch = 'transmissao' | 'chevrolet';

export interface CommercialInsight {
  tipo: 'alerta' | 'oportunidade' | 'info' | 'sucesso';
  titulo: string;
  descricao: string;
}

export interface DailyInsightSnapshot {
  dia: string;
  periodo: { inicio: string; fim: string };
  insights: CommercialInsight[];
}
