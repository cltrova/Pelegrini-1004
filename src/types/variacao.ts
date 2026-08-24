// Tipos para os dados de Variação (Fluxo de Caixa - DFC)

export interface VariacaoRecord {
  Empresa: string;
  Conta: string;
  CodEmpresa: number;
  NumConta: string;
  CodTradutor: number;
  Periodo: string;
  Descricao: string;
  Grupo: string;
  Nivel: number;
  TipoLancamento: string;
  TipoLancamento2: string;
  ano_mes: string;
  Data_Movimento: string;
  Valor: number;
  // Campo para filtro multi-tenant
  CodEmpresa_bi?: string;
}

export interface VariacaoFilters {
  empresa?: string;
  ano?: string;
}

// Tipo para conta individual dentro de um grupo
export interface DFCContaDetalhe {
  numConta: string;
  descricao: string;
  valorPeriodo1: number;
  valorPeriodo2: number;
  valorVariacao: number;
  variacao: number | null;
}

// Tipo para linha da Demonstração do Fluxo de Caixa
export interface DFCLinha {
  id: string;
  descricao: string;
  valorPeriodo1: number | null;
  valorPeriodo2: number | null;
  valorVariacao: number | null;
  variacao: number | null;
  tipo: 'titulo' | 'subtitulo' | 'item' | 'totalizador' | 'espaco';
  grupo?: string;
  ordem: number;
  // Detalhes das contas que compõem este item
  contasDetalhes?: DFCContaDetalhe[];
  // Indicadores de direção por período (para itens de Ativos/Passivos)
  direcaoP1?: 'aumento' | 'reducao' | null;
  direcaoP2?: 'aumento' | 'reducao' | null;
  invertCores?: boolean;
}

// Estrutura da DFC seguindo o modelo contábil
export interface DFCSecao {
  id: string;
  titulo: string;
  linhas: DFCLinha[];
  subtotal?: DFCLinha;
}

// Totais gerais da DFC
export interface DFCTotais {
  variacaoLiquidaCaixa: { periodo1: number; periodo2: number; variacao: number };
  caixaInicio: { periodo1: number; periodo2: number; variacao: number };
  caixaFinal: { periodo1: number; periodo2: number; variacao: number };
}

// Dados completos da DFC para exibição
export interface DFCData {
  secoes: DFCSecao[];
  linhas: DFCLinha[];
  totais: DFCTotais;
}

// Tipos antigos mantidos para compatibilidade com Dashboard
export interface FluxoCaixaGrupo {
  grupo: string;
  saldoInicial: number;
  saldoFinal: number;
  valorVariacao: number;
}

export interface FluxoCaixaTotais {
  saldoInicial: number;
  saldoFinal: number;
  valorVariacao: number;
}
