export type ResumoTipoOrigem = 'DUPLICATA' | 'PEDIDO';
export type ResumoStatus = 'PAGO' | 'A_RECEBER';

export interface ResumoRecord {
  CodEmpresa_bi: number | string;
  CodEmpresa: string;
  NomeEmpresa: string;
  TipoOrigem: ResumoTipoOrigem;
  Status: ResumoStatus | string;
  Id: string;
  CodCliente: string;
  Cliente: string;
  Data: string | null;
  DataVencimento: string | null;
  DataPagamento: string | null;
  Valor: number;
  ValorRecebido: number;
  DiasAtraso: number;
  CodVendInterno: number | null;
  CodPedido: string | null;
}

/** Duplicata agregada (deduplicada por Id) */
export interface DuplicataAgregada {
  id: string;
  cliente: string;
  codCliente: string;
  empresas: string[]; // filiais distintas em que aparece
  valor: number;
  valorRecebido: number;
  status: ResumoStatus;
  data: string | null;
  dataVencimento: string | null;
  dataPagamento: string | null;
  diasAtraso: number;
  pedidosVinculados: string[];
  /** Situação derivada: pago | a_vencer | vence_hoje | vencida */
  situacao: 'pago' | 'a_vencer' | 'vence_hoje' | 'vencida';
}

/** Pedido (sem duplicata vinculada – em aberto, ainda não faturado) */
export interface PedidoAberto {
  id: string;
  codPedido: string;
  cliente: string;
  codCliente: string;
  empresa: string;
  data: string | null;
  diasEmAberto: number;
  codVendInterno: number | null;
  valor?: number;
}

/** Estágio do dinheiro na carteira */
export type EstagioCarteira = 'EM_ABERTO' | 'FATURADO_A_RECEBER' | 'RECEBIDO';

export interface FunilSegmento {
  estagio: EstagioCarteira;
  label: string;
  valor: number;
  quantidade: number;
  percentual: number;
}

export interface ResumoKPIs {
  totalAberto: number;
  totalRecebido: number;
  totalVencido: number;
  totalAVencer: number;
  totalPedidosEmAberto: number;
  qtdDuplicatasAbertas: number;
  qtdDuplicatasPagas: number;
  qtdDuplicatasVencidas: number;
  qtdPedidosAbertos: number;
  qtdClientesInadimplentes: number;
  ticketMedio: number;
  diasMedioAtraso: number;
  taxaInadimplencia: number; // %
}

export interface ResumoFilters {
  search: string;
  status: 'todos' | 'pago' | 'a_receber' | 'vencida' | 'a_vencer' | 'em_aberto_nao_faturado' | 'faturado_a_receber';
  empresa: string; // 'todas' ou cód filial
  anos?: string[];
  meses?: string[];
  dataInicio: string | null; // vencimento
  dataFim: string | null;
}

export interface ClienteAgregado {
  codCliente: string;
  cliente: string;
  totalAberto: number;
  totalVencido: number;
  totalRecebido: number;
  qtdDuplicatas: number;
  qtdVencidas: number;
  maiorAtraso: number;
}

/** Faixa de aging (envelhecimento de atrasos) */
export interface AgingFaixa {
  label: string;
  minDias: number;
  maxDias: number;
  valor: number;
  quantidade: number;
  percentual: number; // % do total vencido
}

/** Bucket de projeção de recebimentos */
export interface ProjecaoBucket {
  label: string;       // ex: "7d", "15d", "30d", "60d", "90d", "+90d"
  ateDias: number;     // limite superior em dias
  valor: number;
  quantidade: number;
}

/** Provisão para Devedores Duvidosos */
export interface PDDResultado {
  total: number;       // valor estimado de perda
  percentual: number;  // % sobre total a receber
  porFaixa: { label: string; valor: number; taxa: number }[];
}

/** Score de pontualidade do cliente */
export type ClassificacaoCliente = 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO';

export interface ClienteAnalytics {
  codCliente: string;
  cliente: string;
  totalAberto: number;
  totalVencido: number;
  totalRecebido: number;
  qtdDuplicatas: number;
  qtdPagas: number;
  qtdVencidas: number;
  qtdPagasNoPrazo: number;
  qtdPagasEmAtraso: number;
  atrasoMedioHistorico: number;     // dias médios de atraso nos pagamentos passados
  atrasoMedioAtual: number;         // dias médios de atraso nas duplicatas vencidas hoje
  maiorAtraso: number;
  prazoMedioAcordado: number;       // dias entre Data e DataVencimento
  prazoMedioReal: number;           // dias entre Data e DataPagamento (apenas pagas)
  pontualidadeScore: number;        // 0-100
  classificacao: ClassificacaoCliente;
  percentualNoPrazo: number;        // % das pagas que foram no prazo
  primeiraOperacao: string | null;
  ultimaOperacao: string | null;
}

/** Alerta crítico para banner */
export interface AlertaCritico {
  id: string;
  tipo: 'CONCENTRACAO' | 'CLIENTE_RISCO' | 'VENCIMENTO_HOJE' | 'AGING_EXTREMO';
  titulo: string;
  descricao: string;
  valor?: number;
  severidade: 'alta' | 'media';
}
