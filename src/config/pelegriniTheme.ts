export type PelegriniThemeKey = 'pelegrini' | 'transmissao' | 'chevrolet';

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
  businessWords: string[];
  trustSignals: string[];
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
    businessWords: ['Comercial', 'Operacional', 'Financeiro', 'Atendimento'],
    trustSignals: ['Gestão integrada', 'Filiais conectadas', 'Decisão rápida'],
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
    businessWords: ['Câmbio', 'Diferencial', 'Motor', 'Óleos e aditivos'],
    trustSignals: ['ZF', 'Eaton', 'MWM', 'Meritor'],
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
    accent: '#FFFFFF',
    surface: '#061B34',
    glow: 'rgba(3, 78, 153, 0.28)',
    motion: 'chevrolet',
    businessWords: ['Peças originais', 'Freio', 'Arrefecimento', 'Motor'],
    trustSignals: ['Desde 1992', 'Entrega rápida', 'Atendimento especializado'],
  },
};

export function getPelegriniThemeKey(filialId?: string | null): PelegriniThemeKey {
  if (filialId === 'transmissao') return 'transmissao';
  if (filialId === 'chevrolet') return 'chevrolet';
  return 'pelegrini';
}

export function resolvePelegriniTheme(filialId?: string | null): PelegriniTheme {
  return PELEGRINI_THEMES[getPelegriniThemeKey(filialId)];
}
