export const VENDEDORES_CT_CAMPANHA_1004 = ['78', '98', '59', '63', '71'] as const;
export const VENDEDORES_EXTRAS_CAMPANHA_1004 = ['99', '11', '34', '47'] as const;

const VENDEDORES_CT_CAMPANHA_1004_SET = new Set<string>(VENDEDORES_CT_CAMPANHA_1004);
const VENDEDORES_EXTRAS_CAMPANHA_1004_SET = new Set<string>(VENDEDORES_EXTRAS_CAMPANHA_1004);

const CODIGO_API_CANONICO_CAMPANHA_1004: Record<string, string> = {
  // /comercial/produtos pode retornar FERNANDO CCH como 45, enquanto o filtro usa 34.
  '45': '34',
  // O FAT da campanha MWM traz RAFAEL CCH como 85, enquanto o cadastro comercial usa 47.
  '85': '47',
};

export function codigoVendedorCampanha(item: Record<string, unknown>): string {
  const raw = item.cod_vendedor_externo
    ?? item.cod_vendedor_interno
    ?? item.cod_vendedor_meta
    ?? item.vendedor_codigo;

  return raw != null ? String(raw).trim() : '';
}

export function codigoVendedorCampanha1004(item: Record<string, unknown>): string {
  const codigo = codigoVendedorCampanha(item);
  return CODIGO_API_CANONICO_CAMPANHA_1004[codigo] ?? codigo;
}

export function vendedorExtraCampanha1004Selecionavel(codigo: unknown): string | null {
  const raw = String(codigo ?? '').trim();
  const canonico = CODIGO_API_CANONICO_CAMPANHA_1004[raw] ?? raw;
  return VENDEDORES_EXTRAS_CAMPANHA_1004_SET.has(canonico) ? canonico : null;
}

export function vendedorPertenceCampanha1004(
  item: Record<string, unknown>,
  vendedoresExtrasSelecionados?: Set<string>,
): boolean {
  const corrigido = item.vendedor_corrigido_1004 ?? item.vendedorCorrigido1004;
  if (corrigido === true || String(corrigido).toLowerCase() === 'true') return false;

  const codigo = codigoVendedorCampanha1004(item);
  if (VENDEDORES_CT_CAMPANHA_1004_SET.has(codigo)) return true;
  if (!VENDEDORES_EXTRAS_CAMPANHA_1004_SET.has(codigo)) return false;
  return !!vendedoresExtrasSelecionados?.has(codigo);
}
