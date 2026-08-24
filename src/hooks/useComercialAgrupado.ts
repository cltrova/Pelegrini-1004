import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';

// ============================================================================
// Endpoints agrupados — /comercial/agrupado e /comercial/clientes/analise
// (Ideal 1003). Retornam listas já consolidadas no SQL.
// ============================================================================

export type GrupoAgrupado =
  | 'PERIODO'
  | 'DIA_SEMANA'
  | 'VENDEDOR'
  | 'CLIENTE'
  | 'FILIAL'
  | 'ESTADO';

export type Periodicidade = 'diario' | 'mensal' | 'anual';

export interface AgrupadoRow {
  // PERIODO
  periodo?: string;
  // DIA_SEMANA
  numero_dia_semana?: number;
  dia_semana?: string;
  // VENDEDOR
  cod_vendedor?: string | number;
  vendedor?: string;
  // CLIENTE
  cod_cliente?: string | number;
  cliente?: string;
  nome_fantasia?: string;
  cidade?: string;
  estado?: string;
  primeira_compra_periodo?: string;
  ultima_compra_periodo?: string;
  // FILIAL
  cod_empresa?: string | number;
  empresa?: string;
  quantidade_vendedores?: number;
  // Métricas comuns
  total_liquido?: number;
  total_devolucoes?: number;
  total_faturado?: number;
  total_custo?: number;
  total_descontos?: number;
  quantidade_pedidos?: number;
  quantidade_clientes?: number;
  ticket_medio?: number;
  lucro_estimado?: number;
  margem_percentual?: number;
}

export interface ClienteAnalise {
  cod_cliente: string | number;
  cliente: string;
  nome_fantasia?: string;
  cod_vendedor?: string | number;
  vendedor?: string;
  cidade?: string;
  estado?: string;
  faturamento_p1?: number;
  faturamento_p2?: number;
  variacao_valor?: number;
  variacao_percent?: number;
  pedidos_p1?: number;
  pedidos_p2?: number;
  ticket_medio_p1?: number;
  ticket_medio_p2?: number;
  primeira_compra?: string;
  primeira_compra_periodo?: string;
  data_primeira_compra?: string;
  data_primeira_compra_cliente?: string;
  data_cadastro_cliente?: string;
  data_cadastro?: string;
  ultima_compra?: string;
  dias_sem_compra?: number;
  risco?: string;
  [key: string]: unknown;
}

interface AgrupadoParams {
  periodo?: { inicio: string; fim: string };
  grupo: GrupoAgrupado;
  periodicidade?: Periodicidade;
  codCliente?: string | number | null;
  codVendedor?: string | number | null;
  enabled?: boolean;
}

interface AnaliseParams {
  periodo?: { inicio: string; fim: string };
  diasRisco?: number;
  codCliente?: string | number | null;
  enabled?: boolean;
}

function toArray<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.data)) return data.data as T[];
  if (data && Array.isArray(data.items)) return data.items as T[];
  if (data && Array.isArray(data.rows)) return data.rows as T[];
  if (data && Array.isArray(data.result)) return data.result as T[];
  return [];
}

async function fetchAgrupado(
  empresa: any,
  basePath: string,
  params: URLSearchParams,
  label: string,
): Promise<any[]> {
  const path = `${basePath}?${params.toString()}`;
  const url = buildApiProxyUrl(empresa, path);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      signal: ctl.signal,
    });
    if (!res.ok) {
      console.warn(`[${label}] Indisponível (${res.status}) — ${path}`);
      return [];
    }
    const json = await res.json();
    return toArray(json);
  } catch (e) {
    console.warn(`[${label}] Falha:`, e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function periodoDefault(p?: { inicio: string; fim: string }) {
  if (p?.inicio && p?.fim) return p;
  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { inicio: toISO(primeiro), fim: toISO(hoje) };
}

// ---------------------------------------------------------------------------
// Hook principal: /comercial/agrupado?grupo=...
// ---------------------------------------------------------------------------
export function useComercialAgrupado({
  periodo,
  grupo,
  periodicidade,
  codCliente,
  codVendedor,
  enabled = true,
}: AgrupadoParams) {
  const { empresa, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  const basePath = (empresa?.endpoint_path_comercial_agrupado &&
    String(empresa.endpoint_path_comercial_agrupado).trim()) || '/comercial/agrupado';
  const p = periodoDefault(periodo);

  const usesStorage = !!empresa?.json_path_comercial?.startsWith('storage:');
  const hasEndpoint =
    (!!empresa?.endpoint_url || !!empresa?.usar_vps_intermediaria) && !usesStorage;

  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);

  const query = useQuery({
    queryKey: [
      'comercial', 'agrupado',
      empresa?.endpoint_url, empresa?.usar_vps_intermediaria, empresa?.vps_cliente_identificador,
      basePath, grupo, periodicidade || null,
      p.inicio, p.fim, filialAtiva,
      codCliente ?? null, codVendedor ?? null,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('grupo', grupo);
      params.set('data_ini', p.inicio);
      params.set('data_fim', p.fim);
      if (periodicidade) {
        const mapPeri: Record<string, string> = { diario: 'DIARIA', mensal: 'MENSAL', anual: 'ANUAL' };
        params.set('periodicidade', mapPeri[periodicidade] || String(periodicidade).toUpperCase());
      }
      if (codBiParam) params.set('cod_empresa_bi', codBiParam);
      if (codCliente != null && String(codCliente).trim() !== '') params.set('cod_cliente', String(codCliente));
      if (codVendedor != null && String(codVendedor).trim() !== '') params.set('cod_vendedor', String(codVendedor));
      return fetchAgrupado(empresa, basePath, params, `Comercial Agrupado ${grupo}`);
    },
    enabled: !isLoadingEmpresa && hasEndpoint && enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
  });

  return {
    data: (query.data as AgrupadoRow[]) || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

// Atalhos convenientes por grupo -------------------------------------------
export const useAgrupadoPeriodo = (
  periodo: { inicio: string; fim: string } | undefined,
  periodicidade: Periodicidade = 'diario',
  opts?: { codCliente?: string | number | null; codVendedor?: string | number | null; enabled?: boolean },
) => useComercialAgrupado({ periodo, grupo: 'PERIODO', periodicidade, codCliente: opts?.codCliente, codVendedor: opts?.codVendedor, enabled: opts?.enabled });


export const useAgrupadoDiaSemana = (
  periodo: { inicio: string; fim: string } | undefined,
  opts?: { codCliente?: string | number | null; enabled?: boolean },
) => useComercialAgrupado({ periodo, grupo: 'DIA_SEMANA', codCliente: opts?.codCliente, enabled: opts?.enabled });

export const useAgrupadoVendedor = (
  periodo: { inicio: string; fim: string } | undefined,
  opts?: { codCliente?: string | number | null; enabled?: boolean },
) => useComercialAgrupado({ periodo, grupo: 'VENDEDOR', codCliente: opts?.codCliente, enabled: opts?.enabled });

export const useAgrupadoCliente = (
  periodo: { inicio: string; fim: string } | undefined,
  opts?: { codCliente?: string | number | null; codVendedor?: string | number | null; enabled?: boolean },
) => useComercialAgrupado({ periodo, grupo: 'CLIENTE', codCliente: opts?.codCliente, codVendedor: opts?.codVendedor, enabled: opts?.enabled });

export const useAgrupadoFilial = (
  periodo: { inicio: string; fim: string } | undefined,
  opts?: { codCliente?: string | number | null; enabled?: boolean },
) => useComercialAgrupado({ periodo, grupo: 'FILIAL', codCliente: opts?.codCliente, enabled: opts?.enabled });

export const useAgrupadoEstado = (
  periodo: { inicio: string; fim: string } | undefined,
  opts?: { codCliente?: string | number | null; enabled?: boolean },
) => useComercialAgrupado({ periodo, grupo: 'ESTADO', codCliente: opts?.codCliente, enabled: opts?.enabled });

// ---------------------------------------------------------------------------
// /comercial/clientes/analise
// ---------------------------------------------------------------------------
export function useClientesAnalise({ periodo, diasRisco, codCliente, enabled = true }: AnaliseParams) {
  const { empresa, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  // Só consulta quando a fonte estiver explicitamente configurada na empresa.
  // Empresas sem `clientes_analise` no views.yaml (ex.: Pelegrini) retornariam 404.
  const configuredPath = String(empresa?.endpoint_path_comercial_clientes_analise ?? '').trim();
  const basePath = configuredPath || '/comercial/clientes/analise';
  const p = periodoDefault(periodo);

  const usesStorage = !!empresa?.json_path_comercial?.startsWith('storage:');
  const hasEndpoint =
    (!!empresa?.endpoint_url || !!empresa?.usar_vps_intermediaria) && !usesStorage;

  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);

  const query = useQuery({
    queryKey: [
      'comercial', 'clientes-analise',
      empresa?.endpoint_url, empresa?.usar_vps_intermediaria, empresa?.vps_cliente_identificador,
      basePath, p.inicio, p.fim, filialAtiva, diasRisco ?? null, codCliente ?? null,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('data_ini', p.inicio);
      params.set('data_fim', p.fim);
      if (codBiParam) params.set('cod_empresa_bi', codBiParam);
      if (diasRisco != null) params.set('dias_risco', String(diasRisco));
      if (codCliente != null && String(codCliente).trim() !== '') params.set('cod_cliente', String(codCliente));
      return fetchAgrupado(empresa, basePath, params, 'Comercial Clientes/Analise');
    },
    enabled: !isLoadingEmpresa && hasEndpoint && enabled && !!configuredPath,
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
  });

  return {
    data: (query.data as ClienteAnalise[]) || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
