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
  subtitle: 'Gestao automotiva por filial',
  eyebrow: 'Grupo Pelegrini',
  headline: 'Pelegrini em tempo real: vendas, estoque, financeiro e atendimento por filial',
  footer: 'Pelegrini · Casa da Transmissao · Casa do Chevrolet',
  version: 'v1.0.0',
} as const;

export const pelegriniModules: PelegriniHomeModule[] = [
  {
    title: 'WhatsApp',
    description: 'Conversas, agentes e fila de atendimento para manter o ritmo do balcao.',
    path: '/whatsapp',
    features: ['Chat', 'Agentes', 'Relatorios'],
    moduloKey: 'whatsapp',
    accent: 'emerald',
  },
  {
    title: 'Comercial',
    description: 'Pedidos, clientes, produtos e cotacoes para decisao rapida no balcao.',
    path: '/comercial/dashboard',
    features: ['Metas', 'Clientes', 'Produtos'],
    moduloKey: 'comercial',
    accent: 'purple',
  },
  {
    title: 'Operacional',
    description: 'Estoque, giro e disponibilidade de pecas para acompanhar a execucao.',
    path: '/operacional/estoque',
    features: ['Estoque', 'Giro', 'Alertas'],
    moduloKey: 'operacional',
    accent: 'orange',
  },
  {
    title: 'Financeiro',
    description: 'Resumo, DRE, variacoes, duplicatas e cobranca em uma leitura gerencial.',
    path: '/financeiro',
    features: ['Resumo', 'DRE', 'Cobranca'],
    moduloKey: 'financeiro',
    accent: 'blue',
  },
];

export const pelegriniAdminEntry = {
  title: 'Configuracoes',
  description: 'Empresas, modulos, endpoints e parametros locais do painel.',
  path: '/configuracoes',
  features: ['Endpoints', 'Empresas', 'Modulos'],
} as const;
