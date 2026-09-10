import { useQuery } from '@tanstack/react-query';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolveCodEmpresaBiParam, resolveComercialEndpointPath } from '@/utils/filialEndpoint';
import { isContextoChevrolet10041, vendedorForcaP1004 } from '@/utils/vendedores1004';

export interface ComissaoFiltros {
  data_ini: string;
  data_fim: string;
  cod_meta?: string;
  vendedor_inicial?: string;
  vendedor_final?: string;
  deduzir_devolucao: boolean;
  calcula_st: boolean;
  exibir_valores_margem: boolean;
  dias_uteis_ate_hoje?: string;
  operacao_fiscal_inicial?: string;
  operacao_fiscal_final?: string;
}

export interface ComissaoLinha {
  vendedor: string;
  nome: string;
  objetivoMensal: number;
  objetivoDiario: number;
  objetivoAteHoje: number;
  faturadoAteHoje: number;
  aFaturar: number;
  valorTotal: number;
  pedidosAberto: number | null;
  projecao: number;
  novaProjecao: number;
  pmv: number;
  margem: number;
  devolucao: number;
  st: number;
  raw: Record<string, unknown>;
}

function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function pick(row: Record<string, unknown> | null | undefined, ...keys: string[]): unknown {
  const normalizeKey = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  for (const k of keys) {
    if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== '') return row[k];
    const normalizedTarget = normalizeKey(k);
    const found = Object.keys(row || {}).find((c) =>
      c.toLowerCase() === k.toLowerCase() || normalizeKey(c) === normalizedTarget
    );
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') return row[found];
  }
  return undefined;
}

function looksLikeCodigoVendedor(value: unknown): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}

export function mapComissaoLinha(row: Record<string, unknown>): ComissaoLinha {
  const codigoDireto = pick(row, 'cod_vendedor', 'CodVendedor', 'COD VENDEDOR', 'codigo', 'CodigoVendedor', 'Codigo Vendedor');
  const vendedorGenerico = pick(row, 'vendedor', 'Vendedor', 'VENDEDOR');
  const codigoVendedor = codigoDireto ?? (looksLikeCodigoVendedor(vendedorGenerico) ? vendedorGenerico : '');
  const nomeVendedor = pick(row, 'nome_vendedor', 'NomeVendedor', 'nome', 'vendedor_nome', 'VendedorNome', 'VENDEDOR', 'Vendedor');
  const vendaDireta = num(pick(row, 'venda_direta', 'VendaDireta', 'Venda_Direta', 'valor_venda_direta'));
  const vendaIndireta = num(pick(row, 'venda_indireta', 'VendaIndireta', 'Venda_Indireta', 'valor_venda_indireta'));
  const vendaTotal = vendaDireta + vendaIndireta;
  const pedidosAberto = pick(
    row,
    'PedidosAberto',
    'PedidosEmAberto',
    'pedidos_em_aberto',
    'pedidos_aberto',
    'PEDIDOS EM ABERTO',
    'a_faturar_pedidos',
  );

  return {
    vendedor: String(codigoVendedor ?? ''),
    nome: String(nomeVendedor ?? ''),
    objetivoMensal: num(pick(row, 'objetivo_mensal', 'ObjetivoMensal', 'objetivo')),
    objetivoDiario: num(pick(row, 'objetivo_diario', 'ObjetivoDiario')),
    objetivoAteHoje: num(pick(row, 'objetivo_ate_hoje', 'ObjetivoAteHoje')),
    faturadoAteHoje: num(pick(row, 'acumulada', 'Acumulada', 'valor_acumulado', 'ValorAcumulado', 'faturado_ate_hoje', 'FaturadoAteHoje', 'FAT. ATÉ HOJE', 'FAT ATE HOJE', 'faturado')),
    aFaturar: num(pick(row, 'a_faturar', 'AFaturar', 'A FATURAR')),
    valorTotal: vendaTotal || num(pick(row, 'valor_total', 'ValorTotal', 'total')),
    pedidosAberto: pedidosAberto === undefined ? null : num(pedidosAberto),
    projecao: num(pick(row, 'projecao', 'Projecao')),
    novaProjecao: num(pick(row, 'nova_projecao', 'NovaProjecao', 'NOVA PROJ.', 'NOVA PROJ', 'NovaProj')),
    pmv: num(pick(row, 'pmv', 'PMV', 'preco_medio_venda', 'PrecoMedioVenda')),
    margem: num(pick(row, 'margem', 'Margem', 'valor_margem')),
    devolucao: num(pick(row, 'devolucao_venda', 'DevolucaoVenda', 'Devolucao_Venda', 'devolucao', 'Devolucao', 'valor_devolucao', 'ValorDevolucao')),
    st: num(pick(row, 'st_venda', 'STVenda', 'ST_Venda', 'st', 'ST', 'valor_st')),
    raw: row ?? {},
  };
}

function normalizeVendedor(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, '') : normalized;
}

function hasDataFaturamento(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
}

export function getValorPedidoAberto(row: Record<string, unknown>): number | null {
  const dataFaturamento = pick(row, 'data_faturamento', 'DataFaturamento', 'Data_Faturamento');
  if (hasDataFaturamento(dataFaturamento)) return null;

  const valor = pick(row, 'valor_total_pedido', 'ValorTotalPedido');
  return valor === undefined ? null : num(valor);
}

export function calcularPedidosAbertosPorVendedor(
  rows: Record<string, unknown>[],
  options?: { codEmpresa?: string },
): Map<string, number> {
  const totais = new Map<string, number>();
  const pedidosProcessados = new Set<string>();

  rows.forEach((row, index) => {
    const empresa = String(pick(row, 'cod_empresa', 'CodEmpresa', 'empresa', 'Empresa') ?? '').trim();
    if (options?.codEmpresa && empresa !== options.codEmpresa) return;
    const pedido = String(pick(row, 'cod_pedido', 'CodPedido', 'pedido') ?? '').trim();
    const pedidoKey = pedido ? `${empresa}|${pedido}` : `linha:${index}`;
    if (pedidosProcessados.has(pedidoKey)) return;
    pedidosProcessados.add(pedidoKey);

    const valor = getValorPedidoAberto(row);
    if (valor === null) return;

    const vendedor = normalizeVendedor(pick(row, 'cod_vendedor', 'CodVendedor', 'cod_vendedor_interno', 'CodVendInterno'));
    if (!vendedor) return;
    totais.set(vendedor, (totais.get(vendedor) ?? 0) + valor);
  });

  return totais;
}

function aplicarPedidosAbertosNasComissoes(
  linhas: ComissaoLinha[],
  pedidos: Record<string, unknown>[],
  options?: { codEmpresa?: string },
): ComissaoLinha[] {
  const totais = calcularPedidosAbertosPorVendedor(pedidos, options);
  return linhas.map((linha) => ({
    ...linha,
    pedidosAberto: totais.get(normalizeVendedor(linha.vendedor)) ?? 0,
  }));
}

function extractRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (!json || typeof json !== 'object') return [];
  const payload = json as Record<string, unknown>;
  const nested = payload.pedidos || payload.dados || payload.data || payload.registros || payload.items;
  return Array.isArray(nested) ? nested as Record<string, unknown>[] : [];
}

export async function fetchTodosPedidos(
  empresa: Parameters<typeof buildApiProxyUrl>[0],
  path: string,
  params: URLSearchParams,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Record<string, unknown>[] | null> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 5_000;

  for (let page = 1; page <= 20; page += 1) {
    const pageParams = new URLSearchParams(params);
    pageParams.set('page', String(page));
    pageParams.set('page_size', String(pageSize));
    const url = buildApiProxyUrl(empresa, `${path}?${pageParams.toString()}`);
    const response = await fetch(url, { headers, signal });
    if (!response.ok) return null;
    const batch = extractRows(await response.json());
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }

  return rows;
}

export function comissaoLinhaPertenceForcaP1004(linha: Pick<ComissaoLinha, 'vendedor' | 'nome'>): boolean {
  return vendedorForcaP1004({
    codigo: linha.vendedor,
    nome: linha.nome,
  });
}

export function deveExcluirForcaPComissao1004(codEmpresaAtiva: unknown, filialAtiva?: unknown): boolean {
  const codEmpresa = String(codEmpresaAtiva ?? '').trim();
  const filial = String(filialAtiva ?? '').trim().toLowerCase();
  return codEmpresa === '10041' || codEmpresa === '1004' || filial === 'chevrolet';
}

export function resolveComissaoVendedoresPath(codEmpresaAtiva: unknown, filialAtiva?: unknown, empresa?: unknown): string {
  return isContextoChevrolet10041(codEmpresaAtiva, filialAtiva, empresa)
    ? '/comercial/comissoes_ch'
    : '/comercial/comissoes';
}

export function resolveComissaoPedidosPath(
  empresa: Parameters<typeof resolveComercialEndpointPath>[1],
  filialAtiva?: string | null,
): string {
  if (isContextoChevrolet10041(empresa?.cod_empresa_bi, filialAtiva, empresa)) {
    return empresa?.endpoint_path_comercial_pedidos_ch?.trim() || '/comercial/pedidos_ch';
  }
  return resolveComercialEndpointPath('pedidos', empresa, filialAtiva);
}

export function buildPedidosAbertosSearchParams(
  filtros: ComissaoFiltros,
  codBiParam?: string | null,
  includeCodEmpresaBi = true,
  hoje = new Date(),
): URLSearchParams {
  const params = new URLSearchParams();
  const hojeKey = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, '0'),
    String(hoje.getDate()).padStart(2, '0'),
  ].join('-');
  const dataFimInclusiva = filtros.data_ini <= hojeKey && hojeKey < filtros.data_fim
    ? hojeKey
    : filtros.data_fim;
  const dataFimExclusiva = new Date(`${dataFimInclusiva}T00:00:00`);
  dataFimExclusiva.setDate(dataFimExclusiva.getDate() + 1);

  params.set('data_ini', filtros.data_ini);
  params.set('data_fim', [
    dataFimExclusiva.getFullYear(),
    String(dataFimExclusiva.getMonth() + 1).padStart(2, '0'),
    String(dataFimExclusiva.getDate()).padStart(2, '0'),
  ].join('-'));
  if (includeCodEmpresaBi && codBiParam) params.set('cod_empresa_bi', codBiParam);
  return params;
}

export function buildComissaoSearchParams(filtros: ComissaoFiltros, codBiParam?: string | null): URLSearchParams {
  const params = new URLSearchParams();
  params.set('data_ini', filtros.data_ini);
  params.set('data_fim', filtros.data_fim);
  if (filtros.cod_meta) params.set('cod_meta', filtros.cod_meta);
  if (filtros.vendedor_inicial) params.set('vendedor_inicial', filtros.vendedor_inicial);
  if (filtros.vendedor_final) params.set('vendedor_final', filtros.vendedor_final);
  params.set('deduzir_devolucao', String(filtros.deduzir_devolucao));
  params.set('calcula_st', String(filtros.calcula_st));
  params.set('exibir_valores_margem', String(filtros.exibir_valores_margem));
  if (filtros.dias_uteis_ate_hoje) params.set('dias_uteis_ate_hoje', filtros.dias_uteis_ate_hoje);
  if (filtros.operacao_fiscal_inicial) params.set('operacao_fiscal_inicial', filtros.operacao_fiscal_inicial);
  if (filtros.operacao_fiscal_final) params.set('operacao_fiscal_final', filtros.operacao_fiscal_final);
  if (codBiParam) params.set('cod_empresa_bi', codBiParam);
  return params;
}

export function useComissaoVendedores(filtros: ComissaoFiltros | null, enabled = true) {
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  const path = resolveComissaoVendedoresPath(codEmpresaAtiva, filialAtiva, empresa);
  const pedidosPath = resolveComissaoPedidosPath(empresa, filialAtiva);
  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);
  const deveExcluirForcaP1004 = deveExcluirForcaPComissao1004(codEmpresaAtiva, filialAtiva);

  return useQuery({
    queryKey: ['comissao-vendedores', 'pedidos-null-v7', codEmpresaAtiva, filialAtiva, filtros],
    enabled: !!empresa && !!filtros && enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: async ({ signal }): Promise<ComissaoLinha[]> => {
      if (!filtros) return [];
      const params = buildComissaoSearchParams(filtros, codBiParam);
      const pedidosParams = buildPedidosAbertosSearchParams(filtros, codBiParam, !/_ch(?:\?|$)/.test(pedidosPath));

      const url = buildApiProxyUrl(empresa, `${path}?${params.toString()}`);
      console.log('[Comissao] URL:', `${path}?${params.toString()}`);

      const comissaoController = new AbortController();
      const pedidosController = new AbortController();
      const abortFromQuery = () => {
        comissaoController.abort();
        pedidosController.abort();
      };
      signal.addEventListener('abort', abortFromQuery, { once: true });
      const comissaoTimer = setTimeout(() => comissaoController.abort(), 60000);
      const pedidosTimer = setTimeout(() => pedidosController.abort(), 90000);
      try {
        const headers = { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };
        const [res, pedidos] = await Promise.all([
          fetch(url, { headers, signal: comissaoController.signal }),
          fetchTodosPedidos(empresa, pedidosPath, pedidosParams, headers, pedidosController.signal)
            .catch(() => null),
        ]);
        if (!res.ok) throw new Error(`Comissões: HTTP ${res.status}`);
        const json: unknown = await res.json();
        const payload = json && typeof json === 'object' ? json as Record<string, unknown> : {};
        const nestedRows = payload.dados || payload.data || payload.comissoes || payload.registros;
        const arr: Record<string, unknown>[] = Array.isArray(json)
          ? json as Record<string, unknown>[]
          : Array.isArray(nestedRows) ? nestedRows as Record<string, unknown>[] : [];
        if (arr.length > 0) console.log('[Comissao] Campos da API:', Object.keys(arr[0]));
        const linhas = arr
          .map(mapComissaoLinha)
          .filter((linha) => !deveExcluirForcaP1004 || !comissaoLinhaPertenceForcaP1004(linha));
        if (!pedidos) {
          console.warn('[Comissao] Pedidos indisponiveis; a coluna nao sera preenchida com zero artificial.');
          return linhas;
        }
        return aplicarPedidosAbertosNasComissoes(linhas, pedidos, {
          codEmpresa: /_ch(?:\?|$)/.test(pedidosPath) ? '2' : undefined,
        });
      } finally {
        clearTimeout(comissaoTimer);
        clearTimeout(pedidosTimer);
        signal.removeEventListener('abort', abortFromQuery);
      }
    },
  });
}
