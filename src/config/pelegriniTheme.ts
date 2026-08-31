export type PelegriniThemeKey = 'pelegrini' | 'transmissao' | 'chevrolet';

import type { PelegriniModuleKey } from './pelegriniIdentity';

export interface PelegriniTheme {
  key: PelegriniThemeKey;
  name: string;
  shortName: string;
  tagline: string;
  logoSrc: string;
  logoAlt: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  glow: string;
  motion: 'group' | 'transmission' | 'chevrolet';
  industry: 'automotive-group' | 'heavy-parts' | 'original-chevrolet-parts';
  motif: 'control-map' | 'gearbox-blueprint' | 'catalog-seal';
  panelTone: string;
  chartPalette: string[];
  sidebarLabels: {
    heading: string;
    subheading: string;
    section: string;
  };
  surfacePattern: 'branch-map' | 'technical-grid' | 'parts-catalog';
  businessWords: string[];
  trustSignals: string[];
  navigation: {
    activeIndicator: string;
    rail: string;
    text: string;
  };
  typography: {
    display: string;
    body: string;
    numeric: string;
  };
  data: {
    valueScale: 'fluid';
    chartGrid: string;
    tableStripe: string;
  };
  status: {
    success: string;
    attention: string;
    danger: string;
    information: string;
  };
  density: {
    cardGap: string;
    controlHeight: string;
    pagePadding: string;
  };
}

export interface PelegriniVisual {
  themeKey: PelegriniThemeKey;
  blueprintLabel: string;
  panelMicrocopy: string;
  backgroundMotifs: string[];
  heroNoun: string;
  signalWords: string[];
}

export interface PelegriniModuleVisual {
  moduleKey: PelegriniModuleKey;
  themeKey: PelegriniThemeKey;
  kpiPrefix: string;
  chartLabel: string;
  tableLabel: string;
  actionLabel: string;
}

export const PELEGRINI_THEMES: Record<PelegriniThemeKey, PelegriniTheme> = {
  pelegrini: {
    key: 'pelegrini',
    name: 'Pelegrini',
    shortName: 'Grupo Pelegrini',
    tagline: 'gestao integrada das filiais automotivas',
    logoSrc: '/brand/pelegrini-icon.svg',
    logoAlt: 'Marca Pelegrini',
    primary: '#073F73',
    secondary: '#0B5A9E',
    accent: '#22C7E8',
    surface: '#081827',
    glow: 'rgba(34, 199, 232, 0.28)',
    motion: 'group',
    industry: 'automotive-group',
    motif: 'control-map',
    panelTone: 'white-control-room',
    chartPalette: ['#073F73', '#0B5A9E', '#22C7E8', '#6C7A89'],
    sidebarLabels: {
      heading: 'Grupo Pelegrini',
      subheading: 'Operacao integrada',
      section: 'Painel executivo',
    },
    surfacePattern: 'branch-map',
    businessWords: ['Comercial', 'Operacional', 'Financeiro', 'Atendimento'],
    trustSignals: ['Gestão integrada', 'Filiais conectadas', 'Decisão rápida'],
    navigation: { activeIndicator: '#22C7E8', rail: '#073F73', text: '#EAF4FC' },
    typography: { display: 'Inter', body: 'Inter', numeric: 'ui-monospace' },
    data: { valueScale: 'fluid', chartGrid: '#D8E4EE', tableStripe: '#F5F8FB' },
    status: { success: '#138A63', attention: '#D49A16', danger: '#C43D4B', information: '#0B5A9E' },
    density: { cardGap: '1rem', controlHeight: '2.5rem', pagePadding: '1.5rem' },
  },
  transmissao: {
    key: 'transmissao',
    name: 'Casa da Transmissão',
    shortName: 'CT',
    tagline: 'pecas tecnicas para cambio, diferencial e motor',
    logoSrc: '/brand/casa-transmissao.png',
    logoAlt: 'Logo Casa da Transmissão',
    primary: '#073F73',
    secondary: '#0A5291',
    accent: '#49D2FF',
    surface: '#061626',
    glow: 'rgba(73, 210, 255, 0.26)',
    motion: 'transmission',
    industry: 'heavy-parts',
    motif: 'gearbox-blueprint',
    panelTone: 'industrial-technical',
    chartPalette: ['#073F73', '#49D2FF', '#7A8793', '#E5EEF7'],
    sidebarLabels: {
      heading: 'Casa da Transmissão',
      subheading: 'Cambio, diferencial e motor',
      section: 'Operacao tecnica',
    },
    surfacePattern: 'technical-grid',
    businessWords: ['Câmbio', 'Diferencial', 'Motor', 'Óleos e aditivos'],
    trustSignals: ['ZF', 'Eaton', 'MWM', 'Meritor'],
    navigation: { activeIndicator: '#49D2FF', rail: '#073F73', text: '#EFF9FF' },
    typography: { display: 'Inter', body: 'Inter', numeric: 'ui-monospace' },
    data: { valueScale: 'fluid', chartGrid: '#D7E4EF', tableStripe: '#F3F7FA' },
    status: { success: '#118A68', attention: '#D49A16', danger: '#C43D4B', information: '#0A5291' },
    density: { cardGap: '1rem', controlHeight: '2.5rem', pagePadding: '1.5rem' },
  },
  chevrolet: {
    key: 'chevrolet',
    name: 'Casa do Chevrolet',
    shortName: 'CCH',
    tagline: 'pecas originais Chevrolet com atendimento especializado',
    logoSrc: '/brand/casa-chevrolet.png',
    logoAlt: 'Logo Casa do Chevrolet',
    primary: '#034E99',
    secondary: '#0A67BF',
    accent: '#E8B923',
    surface: '#061B34',
    glow: 'rgba(3, 78, 153, 0.28)',
    motion: 'chevrolet',
    industry: 'original-chevrolet-parts',
    motif: 'catalog-seal',
    panelTone: 'original-parts-counter',
    chartPalette: ['#034E99', '#E8B923', '#FFFFFF', '#547EA8'],
    sidebarLabels: {
      heading: 'Casa do Chevrolet',
      subheading: 'Pecas originais Chevrolet',
      section: 'Balcao e entrega',
    },
    surfacePattern: 'parts-catalog',
    businessWords: ['Peças originais', 'Freio', 'Arrefecimento', 'Motor'],
    trustSignals: ['Desde 1992', 'Entrega rápida', 'Atendimento especializado'],
    navigation: { activeIndicator: '#E8B923', rail: '#034E99', text: '#F3F8FC' },
    typography: { display: 'Inter', body: 'Inter', numeric: 'ui-monospace' },
    data: { valueScale: 'fluid', chartGrid: '#D9E4EF', tableStripe: '#F5F8FC' },
    status: { success: '#168664', attention: '#E8B923', danger: '#C43D4B', information: '#0A67BF' },
    density: { cardGap: '1rem', controlHeight: '2.5rem', pagePadding: '1.5rem' },
  },
};

const visuals: Record<PelegriniThemeKey, PelegriniVisual> = {
  pelegrini: {
    themeKey: 'pelegrini',
    blueprintLabel: 'Mapa operacional Pelegrini',
    panelMicrocopy: 'CT e CCH conectadas em vendas, estoque, caixa e atendimento.',
    backgroundMotifs: ['branch-map', 'control-lines', 'module-axis'],
    heroNoun: 'central operacional',
    signalWords: ['Filiais', 'Modulos', 'Indicadores'],
  },
  transmissao: {
    themeKey: 'transmissao',
    blueprintLabel: 'Cambio, diferencial e motor',
    panelMicrocopy: 'Leitura tecnica com ZF, Eaton, MWM e Meritor no centro da operacao.',
    backgroundMotifs: ['gear-ratio', 'differential-lines', 'heavy-shaft'],
    heroNoun: 'mesa tecnica',
    signalWords: ['Aplicacao', 'Codigo', 'Marca'],
  },
  chevrolet: {
    themeKey: 'chevrolet',
    blueprintLabel: 'Original GM e entrega rapida',
    panelMicrocopy: 'Balcao Chevrolet desde 1992, com estoque, procedencia e atendimento.',
    backgroundMotifs: ['catalog-tabs', 'delivery-route', 'original-seal'],
    heroNoun: 'balcao original',
    signalWords: ['Original', 'Pedido', 'Entrega'],
  },
};

const moduleVisuals: Record<PelegriniThemeKey, Record<PelegriniModuleKey, PelegriniModuleVisual>> = {
  pelegrini: {
    whatsapp: { moduleKey: 'whatsapp', themeKey: 'pelegrini', kpiPrefix: 'Atendimentos', chartLabel: 'Ritmo das conversas', tableLabel: 'Fila integrada', actionLabel: 'Acompanhar fila' },
    comercial: { moduleKey: 'comercial', themeKey: 'pelegrini', kpiPrefix: 'Pedidos consolidados', chartLabel: 'Venda por filial', tableLabel: 'Carteira de clientes', actionLabel: 'Analisar venda' },
    operacional: { moduleKey: 'operacional', themeKey: 'pelegrini', kpiPrefix: 'Estoque conectado', chartLabel: 'Giro por filial', tableLabel: 'Disponibilidade', actionLabel: 'Ver estoque' },
    financeiro: { moduleKey: 'financeiro', themeKey: 'pelegrini', kpiPrefix: 'Resultado consolidado', chartLabel: 'Caixa e DRE', tableLabel: 'Leitura financeira', actionLabel: 'Analisar resultado' },
  },
  transmissao: {
    whatsapp: { moduleKey: 'whatsapp', themeKey: 'transmissao', kpiPrefix: 'Atendimento tecnico', chartLabel: 'Demanda por aplicacao pesada', tableLabel: 'Fila de orcamentos tecnicos', actionLabel: 'Responder tecnico' },
    comercial: { moduleKey: 'comercial', themeKey: 'transmissao', kpiPrefix: 'Pedidos tecnicos', chartLabel: 'Curva de cambio e diferencial', tableLabel: 'Pecas por codigo e marca', actionLabel: 'Priorizar aplicacao' },
    operacional: { moduleKey: 'operacional', themeKey: 'transmissao', kpiPrefix: 'Giro tecnico', chartLabel: 'Estoque de cambio, diferencial e motor', tableLabel: 'Aplicacoes criticas', actionLabel: 'Ver disponibilidade' },
    financeiro: { moduleKey: 'financeiro', themeKey: 'transmissao', kpiPrefix: 'Margem tecnica', chartLabel: 'Resultado de pecas pesadas', tableLabel: 'Centro de custo tecnico', actionLabel: 'Ler margem' },
  },
  chevrolet: {
    whatsapp: { moduleKey: 'whatsapp', themeKey: 'chevrolet', kpiPrefix: 'Atendimento original', chartLabel: 'Pedidos Chevrolet no WhatsApp', tableLabel: 'Fila de balcao original', actionLabel: 'Responder cliente' },
    comercial: { moduleKey: 'comercial', themeKey: 'chevrolet', kpiPrefix: 'Pedidos originais', chartLabel: 'Curva de pecas Chevrolet', tableLabel: 'Clientes, oficinas e frotistas', actionLabel: 'Acelerar pedido' },
    operacional: { moduleKey: 'operacional', themeKey: 'chevrolet', kpiPrefix: 'Estoque original', chartLabel: 'Disponibilidade Chevrolet', tableLabel: 'Pecas com procedencia', actionLabel: 'Separar item' },
    financeiro: { moduleKey: 'financeiro', themeKey: 'chevrolet', kpiPrefix: 'Resultado original', chartLabel: 'Receita de pecas Chevrolet', tableLabel: 'Recebiveis do balcao', actionLabel: 'Ver caixa' },
  },
};

export function getPelegriniThemeKey(filialId?: string | null): PelegriniThemeKey {
  if (filialId === 'transmissao' || filialId === '1004') return 'transmissao';
  if (filialId === 'chevrolet' || filialId === '10041') return 'chevrolet';
  return 'transmissao';
}

export function resolvePelegriniTheme(filialId?: string | null): PelegriniTheme {
  return PELEGRINI_THEMES[getPelegriniThemeKey(filialId)];
}

export function resolvePelegriniVisual(filialId?: string | null): PelegriniVisual {
  return visuals[getPelegriniThemeKey(filialId)];
}

export function getPelegriniModuleVisual(
  moduleKey: PelegriniModuleKey,
  themeKey: PelegriniThemeKey,
): PelegriniModuleVisual {
  return moduleVisuals[themeKey][moduleKey];
}
