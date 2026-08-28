import type { PelegriniThemeKey } from './pelegriniTheme';

export const FORBIDDEN_TEMPLATE_TERMS = ['Powered by React', 'BI Reports', 'Lovable'];

export type PelegriniModuleKey = 'whatsapp' | 'comercial' | 'operacional' | 'financeiro';

export interface PelegriniIdentity {
  themeKey: PelegriniThemeKey;
  eyebrow: string;
  heroTitle: string;
  heroSignal: string;
  operatingLine: string;
  microIndicators: string[];
  motionLabel: string;
  footerLine: string;
  selectorDescription: string;
}

export interface PelegriniModuleIdentity {
  key: PelegriniModuleKey;
  title: string;
  operationalLabel: string;
  description: string;
  metricLabel: string;
  tags: string[];
}

const identities: Record<PelegriniThemeKey, PelegriniIdentity> = {
  pelegrini: {
    themeKey: 'pelegrini',
    eyebrow: 'Grupo Pelegrini',
    heroTitle: 'Central de operacao das filiais automotivas',
    heroSignal: 'Vendas, estoque, financeiro e atendimento conectados',
    operatingLine: 'Uma mesa de controle para acompanhar Casa da Transmissao e Casa do Chevrolet.',
    microIndicators: ['Duas filiais', 'Quatro modulos', 'Operacao em tempo real'],
    motionLabel: 'Fluxo integrado de pecas e atendimento',
    footerLine: 'Pelegrini - operacao automotiva integrada',
    selectorDescription: 'Escolha a filial para ajustar visual, filtros e indicadores do painel.',
  },
  transmissao: {
    themeKey: 'transmissao',
    eyebrow: 'Casa da Transmissao',
    heroTitle: 'Operacao tecnica para cambio, diferencial e motor',
    heroSignal: 'Cambio, diferencial, motor e oleos no mesmo painel',
    operatingLine: 'Indicadores orientados para pecas tecnicas, giro e atendimento de balcao.',
    microIndicators: ['Cambio', 'Diferencial', 'ZF', 'Eaton'],
    motionLabel: 'Linhas de transmissao e giro tecnico',
    footerLine: 'Casa da Transmissao - cambio, diferencial e motor',
    selectorDescription: 'Painel com foco em pecas tecnicas, marcas e disponibilidade.',
  },
  chevrolet: {
    themeKey: 'chevrolet',
    eyebrow: 'Casa do Chevrolet',
    heroTitle: 'Pecas originais Chevrolet com atendimento especializado',
    heroSignal: 'Original GM, entrega rapida e tradicao desde 1992',
    operatingLine: 'Indicadores para balcao, pedidos, disponibilidade e relacionamento com clientes.',
    microIndicators: ['Original GM', 'Desde 1992', 'Entrega rapida'],
    motionLabel: 'Faixas de catalogo, pedido e entrega',
    footerLine: 'Casa do Chevrolet - pecas originais e atendimento especializado',
    selectorDescription: 'Painel com foco em pecas originais, pedidos e entrega.',
  },
};

const modules: Record<PelegriniModuleKey, PelegriniModuleIdentity> = {
  whatsapp: {
    key: 'whatsapp',
    title: 'WhatsApp',
    operationalLabel: 'Central de atendimento',
    description: 'Conversas, agentes e fila de atendimento com ritmo de balcao.',
    metricLabel: 'Fila e resposta',
    tags: ['Conversas', 'Agentes', 'Relatorios'],
  },
  comercial: {
    key: 'comercial',
    title: 'Comercial',
    operationalLabel: 'Pedidos e carteira',
    description: 'Clientes, produtos, cotacoes e vendas para decisao rapida.',
    metricLabel: 'Pedidos e margem',
    tags: ['Clientes', 'Produtos', 'Cotacoes'],
  },
  operacional: {
    key: 'operacional',
    title: 'Operacional',
    operationalLabel: 'Estoque e giro',
    description: 'Disponibilidade, prateleira e giro de pecas por filial.',
    metricLabel: 'Estoque e giro',
    tags: ['Estoque', 'Giro', 'Alertas'],
  },
  financeiro: {
    key: 'financeiro',
    title: 'Financeiro',
    operationalLabel: 'Caixa e cobranca',
    description: 'Resumo, DRE, duplicatas e cobranca em leitura executiva.',
    metricLabel: 'Caixa e DRE',
    tags: ['Resumo', 'DRE', 'Cobranca'],
  },
};

export function getPelegriniIdentity(themeKey: PelegriniThemeKey): PelegriniIdentity {
  return identities[themeKey];
}

export function getPelegriniModuleIdentity(moduleKey: PelegriniModuleKey): PelegriniModuleIdentity {
  return modules[moduleKey];
}
