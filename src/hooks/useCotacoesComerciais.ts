import { useQuery } from '@tanstack/react-query';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { CotacaoInvalidaError, normalizarCotacao } from '@/utils/cotacoesComerciais';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import type { CotacaoComercial, CotacaoOrigem } from '@/types/cotacoesComerciais';

export interface CotacoesConsultaFiltros {
  dataIni: string;
  dataFim: string;
  codVendedor?: string | number | null;
  codCliente?: string | number | null;
}

type CotacoesEmpresa = Pick<
  Empresa,
  | 'cod_empresa_bi'
  | 'endpoint_url'
  | 'usar_vps_intermediaria'
  | 'vps_base_url'
  | 'vps_cliente_identificador'
  | 'endpoint_path_comercial_cotacoes_abertas_ch'
  | 'endpoint_path_comercial_vendas_perdidas_ch'
>;

const DEFAULT_PATHS: Record<CotacaoOrigem, string> = {
  abertas: '/comercial/cotacoes_abertas_ch',
  perdidas: '/comercial/vendas_perdidas_ch',
};

function isCotacoesPelegrini(codEmpresaBi: string | null | undefined) {
  const cod = String(codEmpresaBi ?? '').trim();
  return cod === '1004' || cod === '10041';
}

export class CotacoesEndpointError extends Error {
  constructor(
    public readonly kind: 'configuration' | 'upstream' | 'http' | 'payload' | 'network' | 'timeout',
    message: string,
  ) {
    super(message);
    this.name = 'CotacoesEndpointError';
  }
}

function valorOpcional(value: string | number | null | undefined): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? [payload.dados, payload.data, payload.items, payload.rows, payload.registros]
        .find(Array.isArray)
      : undefined;

  if (!Array.isArray(rows) || !rows.every(isRecord)) {
    throw new CotacoesEndpointError('payload', 'Formato inesperado no endpoint de cotacoes');
  }

  return rows;
}

export function buildCotacoesPath(
  origem: CotacaoOrigem,
  filtros: CotacoesConsultaFiltros,
  codEmpresaBi: string,
  configuredPath?: string | null,
): string {
  const codEmpresa = String(codEmpresaBi).trim();
  if (!isCotacoesPelegrini(codEmpresa)) {
    throw new Error('Cotacoes comerciais disponiveis somente para Pelegrini');
  }

  const basePath = String(configuredPath ?? '').trim() || DEFAULT_PATHS[origem];
  const [pathAndQuery, hash = ''] = basePath.split('#', 2);
  const queryIndex = pathAndQuery.indexOf('?');
  const pathOnly = queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? '' : pathAndQuery.slice(queryIndex + 1));
  params.set('data_ini', filtros.dataIni);
  params.set('data_fim', filtros.dataFim);
  const codVendedor = valorOpcional(filtros.codVendedor);
  const codCliente = valorOpcional(filtros.codCliente);
  if (codVendedor) params.set('vendedor', codVendedor);
  if (codCliente) params.set('cliente', codCliente);
  params.set('cod_empresa_bi', codEmpresa);

  return `${pathOnly}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

export function buildCotacoesQueryKey(
  origem: CotacaoOrigem,
  empresa: Pick<CotacoesEmpresa, 'endpoint_url' | 'usar_vps_intermediaria' | 'vps_base_url' | 'vps_cliente_identificador'> | null | undefined,
  filtros: CotacoesConsultaFiltros,
  basePath: string,
  codEmpresaBi = '10041',
) {
  return [
    'cotacoes-comerciais',
    origem,
    empresa?.endpoint_url ?? '',
    Boolean(empresa?.usar_vps_intermediaria),
    empresa?.vps_base_url ?? '',
    empresa?.vps_cliente_identificador ?? '',
    basePath,
    filtros.dataIni,
    filtros.dataFim,
    valorOpcional(filtros.codVendedor),
    valorOpcional(filtros.codCliente),
    codEmpresaBi,
  ] as const;
}

export async function fetchCotacoes(
  empresa: CotacoesEmpresa | null | undefined,
  origem: CotacaoOrigem,
  filtros: CotacoesConsultaFiltros,
  configuredPath?: string | null,
): Promise<CotacaoComercial[]> {
  const path = buildCotacoesPath(origem, filtros, empresa?.cod_empresa_bi ?? '10041', configuredPath);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    let response: Response;
    try {
      response = await fetch(buildApiProxyUrl(empresa, path), {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new CotacoesEndpointError('timeout', 'Cotacoes: tempo limite de 60 segundos excedido');
      }
      throw new CotacoesEndpointError('network', 'Cotacoes: falha de rede ao consultar o ERP');
    }

    if (response.headers.get('x-proxy-upstream-error') === 'true') {
      throw new CotacoesEndpointError('upstream', 'Cotacoes: falha no upstream');
    }
    if (!response.ok) {
      throw new CotacoesEndpointError('http', `Cotacoes: HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CotacoesEndpointError('payload', 'Formato inesperado no endpoint de cotacoes');
    }
    try {
      return extractRows(payload).map((row) => normalizarCotacao(row, origem, new Date()));
    } catch (error) {
      if (error instanceof CotacoesEndpointError) throw error;
      if (error instanceof CotacaoInvalidaError) {
        throw new CotacoesEndpointError('payload', `Cotacoes: payload invalido: ${error.message}`);
      }
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }
}

function useCotacoes(origem: CotacaoOrigem, filtros: CotacoesConsultaFiltros | null) {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const codEmpresaBi = String(codEmpresaAtiva ?? empresa?.cod_empresa_bi ?? '').trim();
  const hasCotacoes = isCotacoesPelegrini(codEmpresaBi);
  const configuredPath = origem === 'abertas'
    ? empresa?.endpoint_path_comercial_cotacoes_abertas_ch
    : empresa?.endpoint_path_comercial_vendas_perdidas_ch;
  const basePath = String(configuredPath ?? '').trim() || DEFAULT_PATHS[origem];
  const hasEndpoint = hasCotacoes && (empresa?.usar_vps_intermediaria
    ? !!valorOpcional(empresa.vps_cliente_identificador)
    : !!valorOpcional(empresa?.endpoint_url));

  const query = useQuery({
    queryKey: buildCotacoesQueryKey(origem, empresa, filtros ?? { dataIni: '', dataFim: '' }, basePath, codEmpresaBi),
    queryFn: () => {
      if (!hasEndpoint) {
        throw new CotacoesEndpointError(
          'configuration',
          'Cotacoes: configure um endpoint direto ou uma rota VPS para a empresa Pelegrini',
        );
      }
      return fetchCotacoes(empresa, origem, filtros!, configuredPath);
    },
    enabled: !isLoadingEmpresa && hasCotacoes && !!filtros,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return { ...query, data: query.error ? undefined : query.data ?? [] };
}

export function useCotacoesAbertas(filtros: CotacoesConsultaFiltros | null) {
  return useCotacoes('abertas', filtros);
}

export function useVendasPerdidas(filtros: CotacoesConsultaFiltros | null) {
  return useCotacoes('perdidas', filtros);
}
