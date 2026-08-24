import type { Empresa } from '@/hooks/useEmpresaConfig';

const DEFAULT_VPS_BASE_URL = 'http://187.77.203.16';

/**
 * Resolve o par (endpoint base, path) que será enviado ao api-proxy
 * considerando se a empresa está configurada para usar a VPS intermediária.
 *
 * - Quando `usar_vps_intermediaria` = true:
 *   - endpoint = vps_base_url (ou default http://187.77.203.16)
 *   - path = `/{vps_cliente_identificador}` + path original
 *
 * - Quando false: usa endpoint_url da empresa e path original (comportamento atual).
 *
 * Os query params do path original são preservados.
 */
export function resolveApiEndpoint(
  empresa: Pick<
    Empresa,
    | 'endpoint_url'
    | 'usar_vps_intermediaria'
    | 'vps_base_url'
    | 'vps_cliente_identificador'
  > | null | undefined,
  path: string
): { endpoint: string; path: string } {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (empresa?.usar_vps_intermediaria) {
    const base = (empresa.vps_base_url || DEFAULT_VPS_BASE_URL).replace(/\/+$/, '');
    const ident = (empresa.vps_cliente_identificador || '').replace(/^\/+|\/+$/g, '');
    const prefix = ident ? `/${ident}` : '';
    return { endpoint: base, path: `${prefix}${normalizedPath}` };
  }

  return { endpoint: empresa?.endpoint_url || '', path: normalizedPath };
}

/**
 * Versão pronta para usar com api-proxy:
 * retorna a URL completa do proxy já com endpoint/path resolvidos e encodados.
 */
export function buildApiProxyUrl(
  empresa: Parameters<typeof resolveApiEndpoint>[0],
  path: string,
  proxyBase?: string
): string {
  const base =
    proxyBase || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-proxy`;
  const { endpoint, path: finalPath } = resolveApiEndpoint(empresa, path);
  return `${base}?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(finalPath)}`;
}
