import { useQuery } from '@tanstack/react-query';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import { vendedorForcaP1004 } from '@/utils/vendedores1004';

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
  pedidosAberto: number;
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

function pick(row: any, ...keys: string[]): unknown {
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

export function mapComissaoLinha(row: any): ComissaoLinha {
  const codigoDireto = pick(row, 'cod_vendedor', 'CodVendedor', 'COD VENDEDOR', 'codigo', 'CodigoVendedor', 'Codigo Vendedor');
  const vendedorGenerico = pick(row, 'vendedor', 'Vendedor', 'VENDEDOR');
  const codigoVendedor = codigoDireto ?? (looksLikeCodigoVendedor(vendedorGenerico) ? vendedorGenerico : '');
  const nomeVendedor = pick(row, 'nome_vendedor', 'NomeVendedor', 'nome', 'vendedor_nome', 'VendedorNome', 'VENDEDOR', 'Vendedor');
  const vendaDireta = num(pick(row, 'venda_direta', 'VendaDireta', 'Venda_Direta', 'valor_venda_direta'));
  const vendaIndireta = num(pick(row, 'venda_indireta', 'VendaIndireta', 'Venda_Indireta', 'valor_venda_indireta'));
  const vendaTotal = vendaDireta + vendaIndireta;

  return {
    vendedor: String(codigoVendedor ?? ''),
    nome: String(nomeVendedor ?? ''),
    objetivoMensal: num(pick(row, 'objetivo_mensal', 'ObjetivoMensal', 'objetivo')),
    objetivoDiario: num(pick(row, 'objetivo_diario', 'ObjetivoDiario')),
    objetivoAteHoje: num(pick(row, 'objetivo_ate_hoje', 'ObjetivoAteHoje')),
    faturadoAteHoje: num(pick(row, 'acumulada', 'Acumulada', 'valor_acumulado', 'ValorAcumulado', 'faturado_ate_hoje', 'FaturadoAteHoje', 'FAT. ATÉ HOJE', 'FAT ATE HOJE', 'faturado')),
    aFaturar: num(pick(row, 'a_faturar', 'AFaturar', 'A FATURAR')),
    valorTotal: vendaTotal || num(pick(row, 'valor_total', 'ValorTotal', 'total')),
    pedidosAberto: num(pick(row, 'A FATURAR', 'a_faturar_pedidos', 'pedidos_em_aberto', 'pedidos_aberto', 'PedidosEmAberto')),
    projecao: num(pick(row, 'projecao', 'Projecao')),
    novaProjecao: num(pick(row, 'nova_projecao', 'NovaProjecao', 'NOVA PROJ.', 'NOVA PROJ', 'NovaProj')),
    pmv: num(pick(row, 'pmv', 'PMV', 'preco_medio_venda', 'PrecoMedioVenda')),
    margem: num(pick(row, 'margem', 'Margem', 'valor_margem')),
    devolucao: num(pick(row, 'devolucao_venda', 'DevolucaoVenda', 'Devolucao_Venda', 'devolucao', 'Devolucao', 'valor_devolucao', 'ValorDevolucao')),
    st: num(pick(row, 'st_venda', 'STVenda', 'ST_Venda', 'st', 'ST', 'valor_st')),
    raw: row ?? {},
  };
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

export function useComissaoVendedores(filtros: ComissaoFiltros | null, enabled = true) {
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  const isChevrolet = filialAtiva === 'chevrolet';
  const path = isChevrolet ? '/comercial/comissoes_ch' : '/comercial/comissoes';
  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);
  const deveExcluirForcaP1004 = deveExcluirForcaPComissao1004(codEmpresaAtiva, filialAtiva);

  return useQuery({
    queryKey: ['comissao-vendedores', codEmpresaAtiva, filialAtiva, filtros],
    enabled: !!empresa && !!filtros && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ComissaoLinha[]> => {
      if (!filtros) return [];
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
      if (codBiParam) params.set('cod_empresa_bi', codBiParam);

      const url = buildApiProxyUrl(empresa, `${path}?${params.toString()}`);
      console.log('[Comissao] URL:', `${path}?${params.toString()}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Comissões: HTTP ${res.status}`);
        const json = await res.json();
        const arr: any[] = Array.isArray(json)
          ? json
          : json?.dados || json?.data || json?.comissoes || json?.registros || [];
        if (arr.length > 0) console.log('[Comissao] Campos da API:', Object.keys(arr[0]));
        return arr
          .map(mapComissaoLinha)
          .filter((linha) => !deveExcluirForcaP1004 || !comissaoLinhaPertenceForcaP1004(linha));
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
