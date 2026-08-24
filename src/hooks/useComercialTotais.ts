import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import type { ComercialKPIs } from '@/types/comercial';

// ============================================================================
// Contrato "resumido" — endpoint /comercial/totais (mantido para retro-compat.)
// ============================================================================
export interface TotaisResponse {
  qtd_pedidos?: number;
  qtd_clientes?: number;
  qtd_vendedores?: number;
  qtd_faturados?: number;
  qtd_pendentes?: number;
  qtd_devolucoes?: number;
  total_valor_pedido?: number;
  total_valor_liquido?: number;
  total_valor_custo?: number;
  total_valor_desconto?: number;
  total_comissao?: number;
  total_faturado?: number;
  total_pendente?: number;
  total_devolucoes?: number;
  total_valor_venda?: number;
  total_valor_devolucao?: number;
  receita?: number;
  desconto?: number;
  // Aliases usados pelo endpoint /comercial/totais novo (Ideal 1003)
  quantidade_vendida?: number;
  quantidade_devolvida?: number;
  total_descontos?: number;
  total_vendas?: number;
  receita_liquida?: number;
  data_ini?: string;
  data_fim?: string;
}

// ============================================================================
// Novos endpoints totalizadores — Ideal 1003 (valores já consolidados no SQL)
// ============================================================================
export interface PedidosTotalResponse {
  total_pedidos?: number;          // Valor Total
  total_notas_fiscais?: number;    // Valor Faturado (bruto de notas)
  total_liquido_faturado?: number; // Valor Faturado líquido (para cálculo oficial)
  quantidade_pedidos?: number;     // Vendas / Pedidos
  ticket_medio?: number;           // Ticket Médio
  quantidade_clientes?: number;    // Clientes Atendidos
  margem_percentual?: number;      // Margem Média
  quantidade_vendedores?: number;  // Vendedores Ativos
  quantidade_faturados?: number;   // Pedidos Faturados
  quantidade_pendentes?: number;   // Pedidos Pendentes
  total_descontos?: number;
  total_liquido?: number;
  total_custo?: number;
  lucro_estimado?: number;
}

export interface DevolucoesTotalResponse {
  valor_total_devolvido?: number;
  quantidade_total_devolvida?: number;
  quantidade_devolucoes?: number;
  quantidade_itens_devolvidos?: number;
  quantidade_clientes?: number;
}

export interface ProdutosTotalResponse {
  quantidade_total_vendida?: number;   // Produtos Vendidos
  quantidade_produtos?: number;         // Distintos
  quantidade_itens_vendidos?: number;   // Linhas / itens
  total_liquido?: number;
  total_venda_sem_desconto?: number;
  total_descontos?: number;
  total_custo?: number;
  lucro_estimado?: number;
  margem_percentual?: number;
  total_icms?: number;
  total_ipi?: number;
  total_st?: number;
  total_frete?: number;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function mapTotaisToKPIs(t: TotaisResponse): ComercialKPIs {
  const faturamentoBruto = num(t.total_valor_venda ?? t.total_valor_pedido ?? t.total_vendas);
  const devolucoes = num(t.total_valor_devolucao ?? t.total_devolucoes);
  const receita = t.receita != null
    ? num(t.receita)
    : t.receita_liquida != null
      ? num(t.receita_liquida)
      : num(t.total_faturado) - devolucoes;
  const desconto = num(t.total_valor_desconto ?? t.desconto ?? t.total_descontos);
  const qtdPedidos = num(t.qtd_pedidos);
  return {
    faturamentoBruto,
    faturamentoLiquido: receita,
    totalDevolucoes: devolucoes,
    totalValorPedido: faturamentoBruto,
    totalValorLiquidoColuna: num(t.total_valor_liquido),
    totalValorCusto: num(t.total_valor_custo),
    totalValorDesconto: desconto,
    ticketMedio: qtdPedidos > 0 ? faturamentoBruto / qtdPedidos : 0,
    qtdPedidos,
    qtdClientes: num(t.qtd_clientes),
    qtdVendedores: num(t.qtd_vendedores),
    carteiraPendente: num(t.total_pendente),
    realizadoFaturado: receita,
  };
}

// ============================================================================
// Helper genérico para chamar um endpoint totalizador
// ============================================================================
async function fetchJson<T>(
  empresa: any,
  basePath: string,
  periodo: { inicio: string; fim: string },
  filialAtiva?: string | null,
  codCliente?: string | number | null,
  label = 'Totalizador',
): Promise<T | {}> {
  const params = new URLSearchParams();
  params.set('data_ini', periodo.inicio);
  params.set('data_fim', periodo.fim);
  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);
  if (codBiParam) params.set('cod_empresa_bi', codBiParam);
  if (codCliente != null && String(codCliente).trim() !== '') {
    params.set('cod_cliente', String(codCliente));
  }

  const path = `${basePath}?${params.toString()}`;
  const fullUrl = buildApiProxyUrl(empresa, path);
  console.log(`[${label}] URL: ${path}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[${label}] Indisponível (${res.status}).`);
      return {};
    }
    const data = await res.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as T;
    return {};
  } catch (error) {
    console.warn(`[${label}] Falha ao buscar.`, error);
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function defaultPeriodo(periodo?: { inicio: string; fim: string }) {
  const _hoje = new Date();
  const _pad = (n: number) => String(n).padStart(2, '0');
  const _toLocal = (d: Date) => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
  const _primeiroMesAtual = new Date(_hoje.getFullYear(), _hoje.getMonth(), 1);
  const _ultimoDiaMesAnt = new Date(_primeiroMesAtual.getTime() - 24 * 60 * 60 * 1000);
  const _primeiroDiaMesAnt = new Date(_ultimoDiaMesAnt.getFullYear(), _ultimoDiaMesAnt.getMonth(), 1);
  return {
    inicio: periodo?.inicio || _toLocal(_primeiroDiaMesAnt),
    fim: periodo?.fim || _toLocal(_ultimoDiaMesAnt),
  };
}

// ============================================================================
// Hook original: /comercial/totais (retro-compat.)
// ============================================================================
export function useComercialTotais(
  periodo?: { inicio: string; fim: string },
  codCliente?: string | number | null,
) {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  const usesStorage = !!empresa?.json_path_comercial?.startsWith('storage:');
  const isPelegrini1004Ct = String(codEmpresaAtiva ?? '').trim() === '1004' && String(filialAtiva ?? '').trim() !== 'chevrolet';
  const hasEndpoint = (!!empresa?.endpoint_url || !!empresa?.usar_vps_intermediaria) && !usesStorage && !isPelegrini1004Ct;
  const basePath = (empresa?.endpoint_path_comercial_totais && String(empresa.endpoint_path_comercial_totais).trim())
    || '/comercial/totais';

  const query = useQuery({
    queryKey: [
      'comercial', 'totais',
      empresa?.endpoint_url, empresa?.usar_vps_intermediaria, empresa?.vps_cliente_identificador,
      basePath, empresa?.json_path_comercial,
      periodo?.inicio, periodo?.fim, filialAtiva, codCliente ?? null,
    ],
    queryFn: () => fetchJson<TotaisResponse>(empresa, basePath, defaultPeriodo(periodo), filialAtiva, codCliente, 'Comercial Totais'),
    enabled: !isLoadingEmpresa && hasEndpoint,
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const kpis: ComercialKPIs | null = query.data ? mapTotaisToKPIs(query.data as TotaisResponse) : null;

  return {
    totais: (query.data as TotaisResponse) || null,
    kpis,
    isLoading: query.isLoading,
    error: query.error,
    hasEndpoint,
  };
}

// ============================================================================
// Novo hook: consome os 3 endpoints /total em paralelo (Ideal 1003)
// Retorna diretamente os objetos JSON — sem [0], reduce ou soma local.
// ============================================================================
export function useComercialTotaisIdeal(
  periodo?: { inicio: string; fim: string },
  codCliente?: string | number | null,
  options?: { enabled?: boolean; keepPreviousData?: boolean },
) {
  const { empresa, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  const usesStorage = !!empresa?.json_path_comercial?.startsWith('storage:');
  const hasEndpoint = (!!empresa?.endpoint_url || !!empresa?.usar_vps_intermediaria) && !usesStorage;

  const pathPedidos = (empresa?.endpoint_path_comercial_pedidos_total && String(empresa.endpoint_path_comercial_pedidos_total).trim())
    || '/comercial/pedidos/total';
  const pathDevolucoes = (empresa?.endpoint_path_comercial_devolucoes_total && String(empresa.endpoint_path_comercial_devolucoes_total).trim())
    || '/comercial/devolucoes/total';
  const pathProdutos = (empresa?.endpoint_path_comercial_produtos_total && String(empresa.endpoint_path_comercial_produtos_total).trim())
    || '/comercial/produtos/total';

  const p = defaultPeriodo(periodo);

  const query = useQuery({
    queryKey: [
      'comercial', 'totais-ideal',
      empresa?.endpoint_url, empresa?.usar_vps_intermediaria, empresa?.vps_cliente_identificador,
      pathPedidos, pathDevolucoes, pathProdutos,
      p.inicio, p.fim, filialAtiva, codCliente ?? null,
    ],
    queryFn: async () => {
      const [pedidos, devolucoes, produtos] = await Promise.all([
        fetchJson<PedidosTotalResponse>(empresa, pathPedidos, p, filialAtiva, codCliente, 'Comercial Pedidos/Total'),
        fetchJson<DevolucoesTotalResponse>(empresa, pathDevolucoes, p, filialAtiva, codCliente, 'Comercial Devolucoes/Total'),
        fetchJson<ProdutosTotalResponse>(empresa, pathProdutos, p, filialAtiva, codCliente, 'Comercial Produtos/Total'),
      ]);
      return {
        pedidos: pedidos as PedidosTotalResponse,
        devolucoes: devolucoes as DevolucoesTotalResponse,
        produtos: produtos as ProdutosTotalResponse,
      };
    },
    enabled: !isLoadingEmpresa && hasEndpoint && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: options?.keepPreviousData === false ? undefined : keepPreviousData,
  });

  return {
    pedidos: query.data?.pedidos || null,
    devolucoes: query.data?.devolucoes || null,
    produtos: query.data?.produtos || null,
    isLoading: query.isLoading,
    error: query.error,
    hasEndpoint,
  };
}
