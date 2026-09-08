import { useQuery } from '@tanstack/react-query';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
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
  const pedidosAberto = pick(row, 'PedidosAberto', 'PedidosEmAberto', 'pedidos_em_aberto', 'pedidos_aberto', 'PEDIDOS EM ABERTO', 'a_faturar_pedidos');

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

const PEDIDOS_ABERTOS_PAGE_SIZE = 500;

export function resolvePedidosAbertosPath(): string {
  return '/comercial/pedidos-abertos';
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function hasValue(value: unknown): boolean {
  const normalized = normalizeStatus(value);
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined' && normalized !== '0';
}

function normalizeVendedor(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return normalized;
  return normalized.replace(/^0+(?=\d)/, '');
}

export function getValorPedidoAberto(row: Record<string, unknown>): number | null {
  const status = normalizeStatus(pick(row, 'status_pedido', 'StatusPedido', 'status', 'Status', 'situacao', 'Situacao'));
  const dataFaturamento = pick(row, 'data_faturamento', 'DataFaturamento', 'Data_Faturamento', 'DtFaturamento');
  const numeroNota = pick(row, 'num_nf', 'NumNF', 'NumDocumento', 'numero_nf', 'NumeroNF');
  const faturado = status.includes('faturad') || hasValue(dataFaturamento) || hasValue(numeroNota);
  if (faturado) return null;

  const valor = pick(
    row,
    'valor_total_pedido',
    'ValorTotalPedido',
    'Pedido.Valor Total',
    'Pedido.ValorVenda2',
  );
  return valor === undefined ? null : num(valor);
}

export function calcularPedidosAbertosPorVendedor(
  rows: Record<string, unknown>[],
  options?: { operacaoInicial?: number; operacaoFinal?: number },
): Map<string, number> {
  const totais = new Map<string, number>();
  const pedidosProcessados = new Set<string>();

  rows.forEach((row, index) => {
    const operacaoRaw = pick(row, 'cod_operacao', 'CodOperacao', 'codigo_operacao', 'Pedido.Codigo Operacao');
    if (operacaoRaw !== undefined) {
      const operacao = num(operacaoRaw);
      if (options?.operacaoInicial !== undefined && operacao < options.operacaoInicial) return;
      if (options?.operacaoFinal !== undefined && operacao > options.operacaoFinal) return;
    }

    const empresa = String(pick(row, 'cod_empresa', 'CodEmpresa', 'empresa', 'Empresa') ?? '').trim();
    const pedido = String(pick(row, 'cod_pedido', 'CodPedido', 'pedido', 'Pedido.Codigo Pedido') ?? '').trim();
    const pedidoKey = pedido ? `${empresa}|${pedido}` : `linha:${index}`;
    if (pedidosProcessados.has(pedidoKey)) return;
    pedidosProcessados.add(pedidoKey);

    const valor = getValorPedidoAberto(row);
    if (valor === null) return;

    const vendedor = normalizeVendedor(pick(
      row,
      'cod_vendedor',
      'CodVendedor',
      'cod_vendedor_interno',
      'CodVendInterno',
      'Pedido.Cod Vendedor Interno',
    ));
    if (!vendedor) return;
    totais.set(vendedor, (totais.get(vendedor) ?? 0) + valor);
  });

  return totais;
}

export function aplicarPedidosAbertosNasComissoes(
  linhas: ComissaoLinha[],
  pedidos: Record<string, unknown>[],
  options?: { operacaoInicial?: number; operacaoFinal?: number },
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
  const nested = payload.pedidos
    || payload.Pedidos
    || payload.dados
    || payload.data
    || payload.registros
    || payload.items
    || payload.resultados;
  return Array.isArray(nested) ? nested as Record<string, unknown>[] : [];
}

async function fetchPedidosAbertos(
  empresa: Parameters<typeof buildApiProxyUrl>[0],
  params: URLSearchParams,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Record<string, unknown>[] | null> {
  const rows: Record<string, unknown>[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const pageParams = new URLSearchParams(params);
    pageParams.set('page', String(page));
    pageParams.set('page_size', String(PEDIDOS_ABERTOS_PAGE_SIZE));
    const url = buildApiProxyUrl(empresa, `${resolvePedidosAbertosPath()}?${pageParams.toString()}`);
    const response = await fetch(url, { headers, signal });
    if (!response.ok) return null;

    const batch = extractRows(await response.json());
    rows.push(...batch);
    if (batch.length < PEDIDOS_ABERTOS_PAGE_SIZE) return rows;
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
  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);
  const deveExcluirForcaP1004 = deveExcluirForcaPComissao1004(codEmpresaAtiva, filialAtiva);

  return useQuery({
    queryKey: ['comissao-vendedores', codEmpresaAtiva, filialAtiva, filtros],
    enabled: !!empresa && !!filtros && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ComissaoLinha[]> => {
      if (!filtros) return [];
      const params = buildComissaoSearchParams(filtros, codBiParam);

      const url = buildApiProxyUrl(empresa, `${path}?${params.toString()}`);
      const pedidosParams = new URLSearchParams();
      pedidosParams.set('data_ini', filtros.data_ini);
      pedidosParams.set('data_fim', filtros.data_fim);
      if (codBiParam) pedidosParams.set('cod_empresa_bi', codBiParam);
      if (filtros.operacao_fiscal_inicial) pedidosParams.set('operacao_fiscal_inicial', filtros.operacao_fiscal_inicial);
      if (filtros.operacao_fiscal_final) pedidosParams.set('operacao_fiscal_final', filtros.operacao_fiscal_final);
      console.log('[Comissao] URL:', `${path}?${params.toString()}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const headers = { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };
        const [res, pedidos] = await Promise.all([
          fetch(url, { headers, signal: controller.signal }),
          fetchPedidosAbertos(empresa, pedidosParams, headers, controller.signal).catch(() => null),
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
          console.warn('[Comissao] Endpoint de pedidos em aberto indisponível; AFaturar não será usado como substituto.');
          return linhas;
        }
        return aplicarPedidosAbertosNasComissoes(linhas, pedidos, {
          operacaoInicial: filtros.operacao_fiscal_inicial ? num(filtros.operacao_fiscal_inicial) : undefined,
          operacaoFinal: filtros.operacao_fiscal_final ? num(filtros.operacao_fiscal_final) : undefined,
        });
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
