export interface EstoqueRecord {
  cod_empresa_bi: number;
  cod_empresa: number;
  empresa: string;
  cod_produto: number;
  produto: string;
  cod_fabricante: string;
  cod_fornecedor: string;
  cod_grupo_produto: number;
  grupo: string;
  cod_marca_produto: string;
  marca: string;
  cod_linha: string;
  linha: string | null;
  nr_fabricante: string;
  nr_original: string;
  aplicacao_produto: string;
  localizacao_produto?: string; // only in detalhado
  classe_abc: string;
  quantidade_estoque: number;
  data_ultima_compra: string | null;
  operacao_ultima_compra: string | null;
  data_ultima_transferencia: string | null;
  operacao_ultima_transferencia: string | null;
  data_ultima_venda: string | null;
  cod_cliente_ultima_venda: string;
  cliente_ultima_venda: string;
  quantidade_compra_produto: number;
  valor_estoque: number;
  custo: number;
  custo_fornecedor: number;
  custo_medio: number;
  custo_ultima_compra: number;
  tipo_relatorio: string; // "FILIAL CONSOLIDADA" | "FILIAL SEPARADA"
}

export interface GiroRecord {
  cod_empresa_bi: number;
  empresa: string;
  cod_empresa: number;
  data_movimento: string;
  cod_produto: number;
  produto: string;
  cod_fabricante: string;
  cod_marca: string;
  marca: string;
  cod_grupo: number;
  grupo: string;
  saida_venda: number;
  saida_transferencia: number;
  saida_outras: number;
  saida_devolucao: number;
  entrada_compra: number;
  entrada_transferencia: number;
  entrada_outras: number;
  entrada_devolucao: number;
  valor_total_movimento: number;
  valor_venda: number;
  quantidade_movimentada: number;
  valor_estoque: number;
  quantidade_estoque: number;
  tipo_movimento: string;
  cod_linha: string | null;
  linha: string | null;
}

export type GiroStatus = 'atendendo' | 'alerta' | 'faltando' | 'excesso';

export interface GiroProductSummary {
  cod_produto: number;
  produto: string;
  marca: string;
  grupo: string;
  empresa: string;
  quantidade_estoque: number;
  valor_estoque: number;
  total_vendas: number;
  total_compras: number;
  giro: number; // vendas / estoque
  status: GiroStatus;
  dias_sem_venda: number;
  ultima_venda: string | null;
  total_saida_venda: number;
  total_entrada_compra: number;
  total_saida_transferencia: number;
  total_entrada_transferencia: number;
}

export type ViewMode = 'consolidado' | 'detalhado';

export interface EstoqueFiltersState {
  viewMode: ViewMode;
  empresas: string[];
  marcas: string[];
  grupos: string[];
  curvasABC: string[];
  searchTerm: string;
  diasSemVenda: string; // 'todos' | '0' | '7+' | '15+' | '30+' | '60+' | '90+' | 'custom'
  diasSemVendaCustom?: number;
  periodo: string; // 'todos' | 'hoje' | '7d' | '30d' | 'custom'
  periodoInicio?: string;
  periodoFim?: string;
  /** Empresa 1001: oculta itens com chegada recente (compra ou transferência) da lista de "parados". */
  ocultarChegadaRecente?: boolean;
  /** Janela em dias da regra "chegada recente". Ex: 15, 30, 45, 60. */
  janelaChegadaRecenteDias?: number;
}

export interface GiroFiltersState {
  periodoMeses: number; // 3 | 6 | 12
  statusFilter: GiroStatus[];
  empresas: string[];
  marcas: string[];
  grupos: string[];
  searchTerm: string;
}
