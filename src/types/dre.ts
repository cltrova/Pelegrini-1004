// Tipos para os dados da DRE

export interface DreRecord {
  empresa: string;
  ano_mes: string; // formato YYYY-MM
  nivel: number;
  codigo: string;
  descricao: string;
  grupo: string;
  valor: number;
  ordem: number;
  // Campo para filtro multi-tenant
  cod_empresa_bi?: string;
  // Campos opcionais de vendedor (empresa 1001)
  Vendedor_Interno?: string | null;
  Vendedor_Externo?: string | null;
  Empresa_Vendedor_Interno?: string | null;
  Empresa_Vendedor_Externo?: string | null;
  // Campos extras que podem vir no futuro
  [key: string]: unknown;
}

export interface DreFilters {
  empresa?: string;
  anoMes?: string[];  // Múltiplos períodos
  anos?: string[];    // Múltiplos anos
  meses?: string[];   // Múltiplos meses (01-12)
  dataInicio?: string; // Período por data inicial (YYYY-MM-DD)
  dataFim?: string;    // Período por data final (YYYY-MM-DD)
  codigos?: string[]; // Múltiplos números de conta
  grupos?: string[];  // Múltiplos grupos
  vendedoresInternos?: string[]; // Múltiplos vendedores internos (1001)
  vendedoresExternos?: string[]; // Múltiplos vendedores externos (1001)
  empresasVendedorInterno?: string[]; // Empresa do vendedor interno (1001)
  empresasVendedorExterno?: string[]; // Empresa do vendedor externo (1001)
  searchTerm?: string;
}

export interface DreHierarchyNode {
  record: DreRecord;
  children: DreHierarchyNode[];
  isExpanded: boolean;
  depth: number;
}

export interface DreComparisonPeriod {
  label: string;
  anoMes: string;
}

export interface DreVariation {
  record: DreRecord;
  valorAtual: number;
  valorAnterior: number;
  variacaoAbsoluta: number;
  variacaoPercentual: number | null; // null quando anterior é 0
}

export interface DreGroupSummary {
  grupo: string;
  total: number;
  percentualDoTotal: number;
  itens: number;
}

export interface DreIndicator {
  label: string;
  value: number;
  percentual?: number;
  trend?: 'up' | 'down' | 'stable';
  color?: 'positive' | 'negative' | 'neutral';
}
