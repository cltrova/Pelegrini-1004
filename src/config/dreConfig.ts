// Configuração de mapeamentos da DRE
// Este arquivo pode ser customizado por cliente

export interface DreMapping {
  // Mapeamento de código/ordem/nível para nome amigável
  displayName?: string;
  // Se o valor deve ter o sinal invertido
  invertSign?: boolean;
  // Cor customizada (opcional)
  color?: 'positive' | 'negative' | 'neutral' | 'primary' | 'accent';
  // Ícone customizado (opcional)
  icon?: string;
}

export interface DreMappingConfig {
  // Mapeamento por código
  byCode: Record<string, DreMapping>;
  // Mapeamento por grupo
  byGroup: Record<string, DreMapping>;
  // Códigos que devem ter sinal invertido
  invertSignCodes: string[];
  // Grupos que devem ter sinal invertido
  invertSignGroups: string[];
}

// Configuração padrão - pode ser sobrescrita por cliente
export const defaultDreConfig: DreMappingConfig = {
  byCode: {
    // Exemplo: '1.1': { displayName: 'Receita Bruta de Vendas', color: 'positive' }
  },
  byGroup: {
    // Exemplo: 'RECEITA': { displayName: 'Receitas Operacionais', color: 'positive' }
  },
  invertSignCodes: [
    // Conta que precisa ter sinal invertido conforme regra DAX
    '2.1.2.01.01.00007',
  ],
  invertSignGroups: [],
};

// Ordem de exibição dos grupos conforme estrutura DRE contábil
export const dreGroupOrder: string[] = [
  'Receitas',
  'Impostos', // Deduções de Receita
  'Custos de Vendas de Mercadorias',
  'Custos de Vendas de Serviços',
  'Despesas com Pessoal de Vendas',
  'Outras Despesas com vendas',
  'Provisão para Credito Liquid. Duvidosas',
  'Despesas E-Commerce',
  'Despesas com Pessoal Administrativo',
  'Outras Despesas Administrativas',
  'Despesas Não Dedutiveis',
  'Despesas Tributárias',
  'Receitas Financeiros',
  'Despesas Financeiros',
  'Outras Receitas Operacionais',
  'Juros Sobre Capital Próprio',
  'Outras Despesas',
  'Provisão Para IRPJ e CSLL',
  'Ajustes de Exercícios Anteriores',
  'Sem Descrição',
];

// Mapeamento de grupos para nomes de exibição amigáveis
export const dreGroupDisplayNames: Record<string, string> = {
  'Receitas': 'Receitas',
  'Impostos': '(-) Deduções de Receita',
  'Custos de Vendas de Mercadorias': 'Custos de Vendas de Mercadorias',
  'Custos de Vendas de Serviços': 'Custos de Vendas de Serviços',
  'Despesas com Pessoal de Vendas': 'Despesas Com Pessoal De Vendas',
  'Outras Despesas com vendas': 'Outras Despesas com Vendas',
  'Provisão para Credito Liquid. Duvidosas': 'Provisão para Crédito Liqui. Duvidosas',
  'Despesas E-Commerce': 'Despesas E-Commerce',
  'Despesas com Pessoal Administrativo': 'Despesas Administrativas',
  'Outras Despesas Administrativas': 'Outras Despesas Administrativas',
  'Despesas Não Dedutiveis': 'Despesas não Dedutíveis',
  'Despesas Tributárias': 'Despesas Tributárias',
  'Receitas Financeiros': 'Receitas Financeiras',
  'Despesas Financeiros': 'Despesas Financeiras',
  'Outras Receitas Operacionais': 'Outras Receitas Operacionais',
  'Juros Sobre Capital Próprio': 'Juros Sobre Capital Próprio',
  'Outras Despesas': 'Outras Despesas Não Operacionais',
  'Provisão Para IRPJ e CSLL': 'Provisão Para IRPJ e CSLL',
  'Ajustes de Exercícios Anteriores': 'Ajustes de Exercícios Anteriores',
  'Sem Descrição': 'Outros',
};

// Função para obter o nome de exibição
export function getDisplayName(
  config: DreMappingConfig,
  codigo: string,
  grupo: string,
  descricao: string
): string {
  // Prioridade: código > grupo > descrição original
  if (config.byCode[codigo]?.displayName) {
    return config.byCode[codigo].displayName;
  }
  if (config.byGroup[grupo]?.displayName) {
    return config.byGroup[grupo].displayName;
  }
  return descricao;
}

// Função para verificar se deve inverter o sinal
export function shouldInvertSign(
  config: DreMappingConfig,
  codigo: string,
  grupo: string
): boolean {
  return (
    config.invertSignCodes.includes(codigo) ||
    config.invertSignGroups.includes(grupo)
  );
}

// Função para aplicar o valor com possível inversão de sinal
export function applyValueTransform(
  config: DreMappingConfig,
  codigo: string,
  grupo: string,
  valor: number
): number {
  if (shouldInvertSign(config, codigo, grupo)) {
    return -valor;
  }
  return valor;
}

// Função para obter a cor do item
export function getItemColor(
  config: DreMappingConfig,
  codigo: string,
  grupo: string,
  valor: number
): 'positive' | 'negative' | 'neutral' | 'primary' | 'accent' {
  // Primeiro verifica se há cor configurada
  const codeConfig = config.byCode[codigo];
  if (codeConfig?.color) return codeConfig.color;

  const groupConfig = config.byGroup[grupo];
  if (groupConfig?.color) return groupConfig.color;

  // Senão, usa a cor baseada no valor
  if (valor > 0) return 'positive';
  if (valor < 0) return 'negative';
  return 'neutral';
}
