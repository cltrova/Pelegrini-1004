export type CotacaoStatus = 'aberta' | 'cancelada' | 'recusada' | 'vencida';
export type CotacaoOrigem = 'abertas' | 'perdidas';

export interface CotacaoComercial {
  idCotacao: string;
  numeroCotacao: string;
  dataCotacao: string;
  dataValidade: string | null;
  codCliente: string;
  nomeCliente: string;
  codVendedor: string;
  nomeVendedor: string;
  valor: number;
  status: CotacaoStatus;
  motivoErp: string | null;
  diasEmAberto: number;
  raw: Record<string, unknown>;
}

export type MotivoPerdaCodigo =
  | 'preco'
  | 'prazo_entrega'
  | 'condicao_pagamento'
  | 'concorrencia'
  | 'indisponibilidade_produto'
  | 'cliente_desistiu'
  | 'cotacao_vencida'
  | 'outro';

export interface CotacoesFiltros {
  busca: string;
  vendedores: string[];
  clientes: string[];
  status: CotacaoStatus[];
  motivos: MotivoPerdaCodigo[];
  diasMin: number | null;
  diasMax: number | null;
}

export interface CotacoesKpis {
  quantidade: number;
  valorTotal: number;
  ticketMedio: number;
}
