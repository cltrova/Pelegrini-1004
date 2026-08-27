export const CLIENTE_COD_EMPRESA_BI_PADRAO = '1004' as const;
export const CLIENTE_COD_EMPRESA_BI_CHEVROLET = '10041' as const;
export const CLIENTE_CODIGOS_EMPRESA_BI = [
  CLIENTE_COD_EMPRESA_BI_PADRAO,
  CLIENTE_COD_EMPRESA_BI_CHEVROLET,
] as const;
export const CLIENTE_NOME = 'Pelegrini' as const;

export type Cliente1004Codigo = typeof CLIENTE_CODIGOS_EMPRESA_BI[number];

export type Cliente1004EmpresaFallback = {
  id: string;
  cod_empresa_bi: Cliente1004Codigo;
  nome: string;
  endpoint_url: string;
  modulo_dre: boolean;
  modulo_variacao: boolean;
  modulo_comercial: boolean;
  modulo_assistente_ia: boolean;
  modulo_whatsapp: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  endpoint_path_comercial_pedidos: string;
  endpoint_path_comercial_devolucoes: string;
  endpoint_path_comercial_produtos: string;
  endpoint_path_comercial_pedidos_ch: string;
  endpoint_path_comercial_devolucoes_ch: string;
  endpoint_path_comercial_produtos_ch: string;
  endpoint_path_estoque_giro: string;
  endpoint_path_estoque_consolidado: string;
  endpoint_path_estoque_detalhado: string;
  possui_meta_vendedor: boolean;
  modulo_operacional: boolean;
  usar_vps_intermediaria: boolean;
  vps_base_url: string;
  vps_cliente_identificador: string;
};

const CLIENTE_1004_EMPRESA_FALLBACK_BASE = {
  endpoint_url: '',
  modulo_dre: true,
  modulo_variacao: true,
  modulo_comercial: true,
  modulo_assistente_ia: true,
  modulo_whatsapp: false,
  ativo: true,
  created_at: '',
  updated_at: '',
  endpoint_path_comercial_pedidos: '/comercial/pedidos',
  endpoint_path_comercial_devolucoes: '/comercial/devolucoes',
  endpoint_path_comercial_produtos: '/comercial/produtos',
  endpoint_path_comercial_pedidos_ch: '/comercial/pedidos_ch',
  endpoint_path_comercial_devolucoes_ch: '/comercial/devolucoes_ch',
  endpoint_path_comercial_produtos_ch: '/comercial/produtos_ch',
  endpoint_path_estoque_giro: '/estoque/giro',
  endpoint_path_estoque_consolidado: '/estoque/consolidado',
  endpoint_path_estoque_detalhado: '/estoque/detalhado',
  possui_meta_vendedor: true,
  modulo_operacional: true,
  usar_vps_intermediaria: true,
  vps_base_url: 'http://187.77.203.16',
  vps_cliente_identificador: 'pelegrini',
} as const;

export function normalizeCliente1004(value: unknown): string {
  return String(value ?? '').trim();
}

export function isCliente1004(value: unknown): value is Cliente1004Codigo {
  const normalized = normalizeCliente1004(value);
  return CLIENTE_CODIGOS_EMPRESA_BI.some((codigo) => codigo === normalized);
}

export function assertCliente1004(value: unknown): void {
  if (!isCliente1004(value)) {
    throw new Error('Projeto dedicado aceita apenas cod_empresa_bi=1004 ou 10041');
  }
}

export function resolveCliente1004(value: unknown): Cliente1004Codigo {
  const normalized = normalizeCliente1004(value);
  return isCliente1004(normalized) ? normalized : CLIENTE_COD_EMPRESA_BI_PADRAO;
}

export function getCliente1004EmpresaFallback(value: unknown): Cliente1004EmpresaFallback | null {
  const normalized = normalizeCliente1004(value);
  if (!isCliente1004(normalized)) return null;

  return {
    ...CLIENTE_1004_EMPRESA_FALLBACK_BASE,
    id: `cliente-1004-fallback-${normalized}`,
    cod_empresa_bi: normalized,
    nome: normalized === CLIENTE_COD_EMPRESA_BI_CHEVROLET
      ? 'Casa da Chevrolet'
      : 'Casa da Transmissão',
  };
}
