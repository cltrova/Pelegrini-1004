import type { UserModuleKey } from '@/hooks/useUserModulePermissions';

export interface PelegriniHomeModule {
  title: 'WhatsApp' | 'Comercial' | 'Operacional' | 'Financeiro';
  description: string;
  path: string;
  features: string[];
  moduloKey: UserModuleKey;
  accent: 'emerald' | 'purple' | 'orange' | 'blue';
}

export const pelegriniBrand = {
  name: 'Pelegrini',
  subtitle: 'Painel modular de gestao',
  eyebrow: 'Gestao integrada',
  headline: 'Acompanhe operacao, vendas, financeiro e atendimento em um so lugar',
  footer: 'Pelegrini · Painel modular de gestao',
  version: 'v1.0.0',
} as const;

export const pelegriniModules: PelegriniHomeModule[] = [
  {
    title: 'WhatsApp',
    description: 'Atendimento, conversas, agentes e automacoes em uma rotina organizada.',
    path: '/whatsapp',
    features: ['Chat', 'Agentes', 'Relatorios'],
    moduloKey: 'whatsapp',
    accent: 'emerald',
  },
  {
    title: 'Comercial',
    description: 'Vendas, metas, clientes e performance comercial para decisao rapida.',
    path: '/comercial/dashboard',
    features: ['Metas', 'Clientes', 'Produtos'],
    moduloKey: 'comercial',
    accent: 'purple',
  },
  {
    title: 'Operacional',
    description: 'Estoque, giro e indicadores operacionais para acompanhar a execucao.',
    path: '/operacional/estoque',
    features: ['Estoque', 'Giro', 'Alertas'],
    moduloKey: 'operacional',
    accent: 'orange',
  },
  {
    title: 'Financeiro',
    description: 'Resumo, DRE, variacoes, duplicatas e cobranca em uma visao gerencial.',
    path: '/financeiro',
    features: ['Resumo', 'DRE', 'Cobranca'],
    moduloKey: 'financeiro',
    accent: 'blue',
  },
];
