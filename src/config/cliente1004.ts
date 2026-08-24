export const CLIENTE_COD_EMPRESA_BI_PADRAO = '1004' as const;
export const CLIENTE_COD_EMPRESA_BI_CHEVROLET = '10041' as const;
export const CLIENTE_CODIGOS_EMPRESA_BI = [
  CLIENTE_COD_EMPRESA_BI_PADRAO,
  CLIENTE_COD_EMPRESA_BI_CHEVROLET,
] as const;
export const CLIENTE_NOME = 'Pelegrini' as const;

export type Cliente1004Codigo = typeof CLIENTE_CODIGOS_EMPRESA_BI[number];

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
