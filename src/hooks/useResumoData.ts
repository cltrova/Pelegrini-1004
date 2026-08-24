import { useQuery } from '@tanstack/react-query';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import {
  ResumoRecord,
  DuplicataAgregada,
  PedidoAberto,
  ResumoKPIs,
  ResumoFilters,
  ClienteAgregado,
  AgingFaixa,
  ProjecaoBucket,
  PDDResultado,
  ClienteAnalytics,
  ClassificacaoCliente,
  AlertaCritico,
  FunilSegmento,
} from '@/types/resumo';

function stripStoragePrefix(p: string): string {
  return p.replace(/^storage:/, '').replace(/^\/+/, '');
}

async function fetchResumoFromStorage(path: string): Promise<ResumoRecord[]> {
  const clean = stripStoragePrefix(path);
  const { data, error } = await supabase.storage.from('dados-json').download(clean);
  if (error) throw new Error(`Falha ao baixar JSON: ${error.message}`);
  const text = await data.text();
  // remove caracteres de controle problemáticos
  const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const parsed = JSON.parse(sanitized);
  if (!Array.isArray(parsed)) throw new Error('JSON do Resumo precisa ser um array');
  return parsed as ResumoRecord[];
}

async function fetchResumoFromEndpoint(empresa: any, endpointPath: string): Promise<ResumoRecord[]> {
  let path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  // O endpoint externo exige data_ini e data_fim. Por padrão, puxa do 1º dia do mês atual até hoje.
  if (!/[?&]data_ini=/.test(path)) {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const sep = path.includes('?') ? '&' : '?';
    path = `${path}${sep}data_ini=${fmt(inicio)}&data_fim=${fmt(hoje)}`;
  }
  const url = buildApiProxyUrl(empresa, path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`);
    const text = await res.text();
    const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const parsed = JSON.parse(sanitized);
    if (!Array.isArray(parsed)) throw new Error('Resposta do endpoint Resumo precisa ser um array');
    return parsed as ResumoRecord[];
  } finally {
    clearTimeout(timer);
  }
}

function diasEntre(d1: Date, d2: Date): number {
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function isSentinelDate(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized === '' ||
    /^0{4}-0{2}-0{2}/.test(normalized) ||
    /^0{2}\/0{2}\/0{4}$/.test(normalized) ||
    normalized.startsWith('0001-01-01') ||
    normalized.startsWith('1899-12-30') ||
    normalized.startsWith('1900-01-01') ||
    normalized.toUpperCase() === 'NULL'
  );
}

function parseDate(s: string | null | undefined): Date | null {
  const raw = normalizeText(s);
  if (!raw || isSentinelDate(raw)) return null;

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brMatch) {
    const [, dd, mm, yyyy, hh = '00', min = '00', sec = '00'] = brMatch;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  if (isNaN(d.getTime()) || d.getFullYear() < 1901) return null;
  return d;
}

function hasValidPaymentDate(dataPagamento?: string | null): boolean {
  return parseDate(dataPagamento) !== null;
}

export function useResumoData() {
  const { user } = useAuth();
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();

  const hasJson = !!empresa?.json_path_resumo;
  const hasEndpoint =
    !hasJson &&
    !!empresa?.endpoint_path_resumo &&
    (!!empresa?.endpoint_url || !!empresa?.usar_vps_intermediaria);
  const hasSource = hasJson || hasEndpoint;

  const queryKey = [
    'resumo-financeiro',
    codEmpresaAtiva,
    empresa?.json_path_resumo,
    empresa?.endpoint_path_resumo,
    empresa?.endpoint_url,
    empresa?.usar_vps_intermediaria,
    empresa?.vps_cliente_identificador,
    user?.id,
  ];

  const { hasSearched } = useFinanceiroSearch();

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      let data: ResumoRecord[] = [];
      let offlineError: string | null = null;
      if (hasJson) {
        data = await fetchResumoFromStorage(empresa!.json_path_resumo!);
      } else if (hasEndpoint) {
        try {
          data = await fetchResumoFromEndpoint(empresa, empresa!.endpoint_path_resumo!);
        } catch (error) {
          offlineError = error instanceof Error ? error.message : 'Endpoint externo indisponível';
          console.warn('[Resumo] Endpoint indisponível; exibindo dados zerados:', offlineError);
          data = [];
        }
      } else {
        return { records: [] as ResumoRecord[], offlineError: null };
      }
      // DIAGNÓSTICO: confirmar que está consumindo o JSON inteiro
      const dups = data.filter((r) => normalizeText(r.TipoOrigem).toUpperCase() === 'DUPLICATA');
      const comPagamento = dups.filter((r) => hasValidPaymentDate(r.DataPagamento)).length;
      const semPagamento = dups.length - comPagamento;
      const statusDist: Record<string, number> = {};
      for (const r of dups) {
        const k = normalizeStatus(r.Status, r.DataPagamento);
        statusDist[k] = (statusDist[k] ?? 0) + 1;
      }
      const idsUnicos = new Set(dups.map((r) => String(r.Id))).size;
      // eslint-disable-next-line no-console
      console.log('[Resumo] fonte:', hasJson ? 'storage' : 'endpoint', '| total registros:', data.length, '| duplicatas:', dups.length, '| ids únicos:', idsUnicos, '| com DataPagamento:', comPagamento, '| sem DataPagamento:', semPagamento, '| Status:', statusDist);
      return { records: data, offlineError };
    },
    enabled: !!user && hasSource,
    staleTime: 1000 * 60 * 5,
  });

  return {
    records: query.data?.records ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    offlineError: query.data?.offlineError ?? null,
    refetch: query.refetch,
    hasSource,
  };
}

/** Regra de negócio: duplicata com DataPagamento válido ou status de pago => PAGO. Caso contrário => A_RECEBER. */
function normalizeStatus(rawStatus: any, dataPagamento?: string | null): 'PAGO' | 'A_RECEBER' {
  const status = normalizeText(rawStatus).toUpperCase().replace(/\s+/g, '_');
  if (hasValidPaymentDate(dataPagamento)) return 'PAGO';
  if (
    status === 'PAGO' ||
    status === 'PAGA' ||
    status === 'P' ||
    status === 'QUITADO' ||
    status === 'QUITADA' ||
    status === 'RECEBIDO' ||
    status.startsWith('PAG') ||
    status.startsWith('QUIT')
  ) {
    return 'PAGO';
  }
  return 'A_RECEBER';
}

/**
 * Deduplica DUPLICATAS por Id (já que se repetem por pedido), preserva o valor único da duplicata
 * e calcula situação de vencimento a partir do status financeiro.
 */
export function aggregateDuplicatas(records: ResumoRecord[]): DuplicataAgregada[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const duplicatas = records.filter((r) => normalizeText(r.TipoOrigem).toUpperCase() === 'DUPLICATA');
  const map = new Map<string, DuplicataAgregada>();

  for (const r of duplicatas) {
    const duplicataId = String(r.Id);
    const status = normalizeStatus(r.Status, r.DataPagamento);
    const venc = parseDate(r.DataVencimento);
    let situacao: DuplicataAgregada['situacao'] = 'a_vencer';

    if (status === 'PAGO') {
      situacao = 'pago';
    } else if (venc) {
      const diasAtraso = diasEntre(venc, today);
      if (diasAtraso > 0) situacao = 'vencida';
      else if (diasAtraso === 0) situacao = 'vence_hoje';
      else situacao = 'a_vencer';
    }

    const existing = map.get(duplicataId);
    const valor = Number(r.Valor) || 0;
    const valorRecebido = Number(r.ValorRecebido) || 0;
    const valorRecebidoEfetivo = status === 'PAGO' ? Math.max(valorRecebido, valor) : 0;
    const diasAtraso =
      status === 'PAGO'
        ? 0
        : Number(r.DiasAtraso) > 0
          ? Number(r.DiasAtraso)
          : venc
            ? Math.max(0, diasEntre(venc, today))
            : 0;

    if (!existing) {
      map.set(duplicataId, {
        id: duplicataId,
        cliente: r.Cliente,
        codCliente: String(r.CodCliente ?? ''),
        empresas: [r.NomeEmpresa],
        valor,
        valorRecebido: valorRecebidoEfetivo,
        status,
        data: r.Data,
        dataVencimento: r.DataVencimento,
        dataPagamento: r.DataPagamento,
        diasAtraso,
        pedidosVinculados: r.CodPedido ? [String(r.CodPedido)] : [],
        situacao,
      });
      continue;
    }

    if (!existing.empresas.includes(r.NomeEmpresa)) existing.empresas.push(r.NomeEmpresa);
    if (r.CodPedido && !existing.pedidosVinculados.includes(String(r.CodPedido))) {
      existing.pedidosVinculados.push(String(r.CodPedido));
    }

    if (status === 'PAGO' && existing.status !== 'PAGO') {
      existing.status = 'PAGO';
      existing.situacao = 'pago';
      existing.dataPagamento = r.DataPagamento;
      existing.valorRecebido = Math.max(existing.valorRecebido, valorRecebidoEfetivo, existing.valor);
      existing.diasAtraso = 0;
    }
  }

  return [...map.values()];
}

/**
 * Pedidos em aberto = registros TipoOrigem=PEDIDO que NÃO possuem duplicata correspondente
 * (sem duplicata vinculada, ainda não faturados).
 */
export function aggregatePedidosAbertos(records: ResumoRecord[]): PedidoAberto[] {
  const pedidosVinculadosADuplicata = new Set<string>();
  for (const r of records.filter((x) => normalizeText(x.TipoOrigem).toUpperCase() === 'DUPLICATA' && x.CodPedido)) {
    pedidosVinculadosADuplicata.add(String(r.CodPedido));
  }

  const today = new Date();
  const pedidos = records.filter(
    (r) => normalizeText(r.TipoOrigem).toUpperCase() === 'PEDIDO' && !pedidosVinculadosADuplicata.has(String(r.Id)),
  );

  // Dedup por Id (mesmo pedido pode aparecer em filiais)
  const seen = new Set<string>();
  const out: PedidoAberto[] = [];
  for (const r of pedidos) {
    if (seen.has(r.Id)) continue;
    seen.add(r.Id);
    const data = parseDate(r.Data);
    const valorPedido = Number(r.Valor) || 0;
    out.push({
      id: r.Id,
      codPedido: r.CodPedido || r.Id,
      cliente: r.Cliente,
      codCliente: r.CodCliente,
      empresa: r.NomeEmpresa,
      data: r.Data,
      diasEmAberto: data ? Math.max(0, diasEntre(data, today)) : Number(r.DiasAtraso) || 0,
      codVendInterno: r.CodVendInterno,
      valor: valorPedido > 0 ? valorPedido : undefined,
    });
  }
  return out;
}

function toCarteiraValor(value: number | null | undefined): number {
  return Math.max(0, Number(value) || 0);
}

export function calcKPIs(
  duplicatas: DuplicataAgregada[],
  pedidosAbertos: PedidoAberto[],
): ResumoKPIs {
  let totalAberto = 0;
  let totalRecebido = 0;
  let totalVencido = 0;
  let totalAVencer = 0;
  let qtdAbertas = 0;
  let qtdPagas = 0;
  let qtdVencidas = 0;
  let somaAtrasos = 0;
  const clientesInadimplentes = new Set<string>();

  for (const d of duplicatas) {
    const valorAberto = toCarteiraValor(d.valor);
    const valorRecebido = toCarteiraValor(d.valorRecebido);

    if (d.status === 'PAGO') {
      qtdPagas++;
      totalRecebido += valorRecebido;
    } else {
      qtdAbertas++;
      totalAberto += valorAberto;
      if (d.situacao === 'vencida') {
        qtdVencidas++;
        totalVencido += valorAberto;
        somaAtrasos += d.diasAtraso;
        clientesInadimplentes.add(d.codCliente);
      } else {
        totalAVencer += valorAberto;
      }
    }
  }

  const totalPedidosEmAberto = pedidosAbertos.reduce((s, p) => s + toCarteiraValor(p.valor), 0);
  const totalGeral = totalPedidosEmAberto + totalAVencer + totalVencido + totalRecebido;

  return {
    totalAberto,
    totalRecebido,
    totalVencido,
    totalAVencer,
    totalPedidosEmAberto,
    qtdDuplicatasAbertas: qtdAbertas,
    qtdDuplicatasPagas: qtdPagas,
    qtdDuplicatasVencidas: qtdVencidas,
    qtdPedidosAbertos: pedidosAbertos.length,
    qtdClientesInadimplentes: clientesInadimplentes.size,
    ticketMedio: qtdAbertas ? totalAberto / qtdAbertas : 0,
    diasMedioAtraso: qtdVencidas ? somaAtrasos / qtdVencidas : 0,
    taxaInadimplencia: totalGeral > 0 ? (totalVencido / totalGeral) * 100 : 0,
  };
}

/** Funil de carteira: 3 estágios proporcionais ao total movimentado */
export function calcFunilCarteira(
  duplicatas: DuplicataAgregada[],
  pedidos: PedidoAberto[],
): FunilSegmento[] {
  const emAberto = pedidos.reduce((s, p) => s + toCarteiraValor(p.valor), 0);
  const faturadoAReceber = duplicatas
    .filter((d) => d.status === 'A_RECEBER')
    .reduce((s, d) => s + toCarteiraValor(d.valor), 0);
  const recebido = duplicatas
    .filter((d) => d.status === 'PAGO')
    .reduce((s, d) => s + toCarteiraValor(d.valorRecebido), 0);

  const total = emAberto + faturadoAReceber + recebido;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return [
    {
      estagio: 'EM_ABERTO',
      label: 'Em Aberto (não faturado)',
      valor: emAberto,
      quantidade: pedidos.length,
      percentual: pct(emAberto),
    },
    {
      estagio: 'FATURADO_A_RECEBER',
      label: 'Faturado a Receber',
      valor: faturadoAReceber,
      quantidade: duplicatas.filter((d) => d.status === 'A_RECEBER').length,
      percentual: pct(faturadoAReceber),
    },
    {
      estagio: 'RECEBIDO',
      label: 'Recebido',
      valor: recebido,
      quantidade: duplicatas.filter((d) => d.status === 'PAGO').length,
      percentual: pct(recebido),
    },
  ];
}

export function aggregateByCliente(duplicatas: DuplicataAgregada[]): ClienteAgregado[] {
  const map = new Map<string, ClienteAgregado>();
  for (const d of duplicatas) {
    const cur = map.get(d.codCliente) ?? {
      codCliente: d.codCliente,
      cliente: d.cliente,
      totalAberto: 0,
      totalVencido: 0,
      totalRecebido: 0,
      qtdDuplicatas: 0,
      qtdVencidas: 0,
      maiorAtraso: 0,
    };
    const valorAberto = toCarteiraValor(d.valor);
    const valorRecebido = toCarteiraValor(d.valorRecebido);
    cur.qtdDuplicatas++;
    if (d.status === 'PAGO') {
      cur.totalRecebido += valorRecebido;
    } else {
      cur.totalAberto += valorAberto;
      if (d.situacao === 'vencida') {
        cur.qtdVencidas++;
        cur.totalVencido += valorAberto;
        if (d.diasAtraso > cur.maiorAtraso) cur.maiorAtraso = d.diasAtraso;
      }
    }
    map.set(d.codCliente, cur);
  }
  return [...map.values()].sort((a, b) => b.totalAberto - a.totalAberto);
}

export function applyFilters(
  duplicatas: DuplicataAgregada[],
  filters: ResumoFilters,
): DuplicataAgregada[] {
  const search = filters.search.trim().toLowerCase();
  const di = filters.dataInicio ? new Date(filters.dataInicio) : null;
  const df = filters.dataFim ? new Date(filters.dataFim) : null;
  return duplicatas.filter((d) => {
    if (search) {
      const hay = `${d.cliente} ${d.codCliente} ${d.id}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (filters.status !== 'todos') {
      if (filters.status === 'pago' && d.status !== 'PAGO') return false;
      if (filters.status === 'a_receber' && d.status !== 'A_RECEBER') return false;
      if (filters.status === 'faturado_a_receber' && d.status !== 'A_RECEBER') return false;
      if (filters.status === 'em_aberto_nao_faturado') return false;
      if (filters.status === 'vencida' && d.situacao !== 'vencida') return false;
      if (filters.status === 'a_vencer' && d.situacao !== 'a_vencer' && d.situacao !== 'vence_hoje') {
        return false;
      }
    }
    if (filters.empresa && filters.empresa !== 'todas') {
      if (!d.empresas.includes(filters.empresa)) return false;
    }
    if (filters.anos?.length || filters.meses?.length) {
      const vencKey = d.dataVencimento?.slice(0, 10);
      if (!vencKey) return false;
      const ano = vencKey.slice(0, 4);
      const mes = vencKey.slice(5, 7);
      if (filters.anos?.length && !filters.anos.includes(ano)) return false;
      if (filters.meses?.length && !filters.meses.includes(mes)) return false;
    }
    if (di || df) {
      const venc = d.dataVencimento ? new Date(d.dataVencimento) : null;
      if (!venc) return false;
      if (di && venc < di) return false;
      if (df && venc > df) return false;
    }
    return true;
  });
}
const AGING_FAIXAS_DEF: { label: string; min: number; max: number }[] = [
  { label: '1-15d', min: 1, max: 15 },
  { label: '16-30d', min: 16, max: 30 },
  { label: '31-60d', min: 31, max: 60 },
  { label: '61-90d', min: 61, max: 90 },
  { label: '90d+', min: 91, max: Infinity },
];

const PDD_TAXAS: { label: string; min: number; max: number; taxa: number }[] = [
  { label: '1-30d', min: 1, max: 30, taxa: 0.05 },
  { label: '31-60d', min: 31, max: 60, taxa: 0.15 },
  { label: '61-90d', min: 61, max: 90, taxa: 0.30 },
  { label: '91-180d', min: 91, max: 180, taxa: 0.60 },
  { label: '+180d', min: 181, max: Infinity, taxa: 1.0 },
];

export function calcAging(duplicatas: DuplicataAgregada[]): AgingFaixa[] {
  const vencidas = duplicatas.filter((d) => d.situacao === 'vencida');
  const totalVencido = vencidas.reduce((s, d) => s + toCarteiraValor(d.valor), 0);

  return AGING_FAIXAS_DEF.map((f) => {
    const itens = vencidas.filter((d) => d.diasAtraso >= f.min && d.diasAtraso <= f.max);
    const valor = itens.reduce((s, d) => s + toCarteiraValor(d.valor), 0);
    return {
      label: f.label,
      minDias: f.min,
      maxDias: f.max,
      valor,
      quantidade: itens.length,
      percentual: totalVencido > 0 ? (valor / totalVencido) * 100 : 0,
    };
  });
}

const PROJECAO_BUCKETS_DEF: { label: string; ate: number }[] = [
  { label: '7d', ate: 7 },
  { label: '15d', ate: 15 },
  { label: '30d', ate: 30 },
  { label: '60d', ate: 60 },
  { label: '90d', ate: 90 },
  { label: '+90d', ate: Infinity },
];

export function calcProjecaoRecebimentos(duplicatas: DuplicataAgregada[]): ProjecaoBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const aReceber = duplicatas.filter(
    (d) => d.status === 'A_RECEBER' && (d.situacao === 'a_vencer' || d.situacao === 'vence_hoje'),
  );

  const buckets: ProjecaoBucket[] = PROJECAO_BUCKETS_DEF.map((b) => ({
    label: b.label,
    ateDias: b.ate,
    valor: 0,
    quantidade: 0,
  }));

  for (const d of aReceber) {
    if (!d.dataVencimento) continue;
    const venc = new Date(d.dataVencimento);
    const dias = diasEntre(today, venc);
    const idx = PROJECAO_BUCKETS_DEF.findIndex((b) => dias <= b.ate);
    const target = idx === -1 ? buckets.length - 1 : idx;
    buckets[target].valor += toCarteiraValor(d.valor);
    buckets[target].quantidade += 1;
  }

  return buckets;
}

export function calcPDD(duplicatas: DuplicataAgregada[]): PDDResultado {
  const vencidas = duplicatas.filter((d) => d.situacao === 'vencida');
  let total = 0;
  const porFaixa = PDD_TAXAS.map((f) => {
    const valor = vencidas
      .filter((d) => d.diasAtraso >= f.min && d.diasAtraso <= f.max)
      .reduce((s, d) => s + toCarteiraValor(d.valor), 0);
    const provisao = valor * f.taxa;
    total += provisao;
    return { label: f.label, valor: provisao, taxa: f.taxa };
  });

  const totalCarteira = duplicatas
    .filter((d) => d.status === 'A_RECEBER')
    .reduce((s, d) => s + toCarteiraValor(d.valor), 0);

  return {
    total,
    percentual: totalCarteira > 0 ? (total / totalCarteira) * 100 : 0,
    porFaixa,
  };
}

function classificar(score: number): ClassificacaoCliente {
  if (score >= 85) return 'EXCELENTE';
  if (score >= 65) return 'BOM';
  if (score >= 40) return 'ATENCAO';
  return 'CRITICO';
}

export function calcClienteAnalytics(duplicatas: DuplicataAgregada[]): ClienteAnalytics[] {
  const map = new Map<string, ClienteAnalytics>();

  for (const d of duplicatas) {
    const key = d.codCliente || d.cliente;
    let cur = map.get(key);
    if (!cur) {
      cur = {
        codCliente: d.codCliente,
        cliente: d.cliente,
        totalAberto: 0,
        totalVencido: 0,
        totalRecebido: 0,
        qtdDuplicatas: 0,
        qtdPagas: 0,
        qtdVencidas: 0,
        qtdPagasNoPrazo: 0,
        qtdPagasEmAtraso: 0,
        atrasoMedioHistorico: 0,
        atrasoMedioAtual: 0,
        maiorAtraso: 0,
        prazoMedioAcordado: 0,
        prazoMedioReal: 0,
        pontualidadeScore: 0,
        classificacao: 'BOM',
        percentualNoPrazo: 0,
        primeiraOperacao: null,
        ultimaOperacao: null,
      };
      map.set(key, cur);
    }

    const valorAberto = toCarteiraValor(d.valor);
    const valorRecebido = toCarteiraValor(d.valorRecebido);

    cur.qtdDuplicatas++;

    const dataEmissao = parseDate(d.data);
    const dataVenc = parseDate(d.dataVencimento);
    const dataPag = parseDate(d.dataPagamento);

    if (dataEmissao) {
      if (!cur.primeiraOperacao || dataEmissao < new Date(cur.primeiraOperacao)) {
        cur.primeiraOperacao = d.data;
      }
      if (!cur.ultimaOperacao || dataEmissao > new Date(cur.ultimaOperacao)) {
        cur.ultimaOperacao = d.data;
      }
    }

    if (d.status === 'PAGO') {
      cur.qtdPagas++;
      cur.totalRecebido += valorRecebido;
      if (dataVenc && dataPag) {
        const atrasoNoPgto = diasEntre(dataVenc, dataPag);
        if (atrasoNoPgto <= 0) {
          cur.qtdPagasNoPrazo++;
        } else {
          cur.qtdPagasEmAtraso++;
          cur.atrasoMedioHistorico += atrasoNoPgto;
        }
      }
      if (dataEmissao && dataPag) {
        cur.prazoMedioReal += diasEntre(dataEmissao, dataPag);
      }
    } else {
      cur.totalAberto += valorAberto;
      if (d.situacao === 'vencida') {
        cur.qtdVencidas++;
        cur.totalVencido += valorAberto;
        cur.atrasoMedioAtual += d.diasAtraso;
        if (d.diasAtraso > cur.maiorAtraso) cur.maiorAtraso = d.diasAtraso;
      }
    }

    if (dataEmissao && dataVenc) {
      cur.prazoMedioAcordado += diasEntre(dataEmissao, dataVenc);
    }
  }

  return [...map.values()].map((c) => {
    const atrasoMedioHistorico = c.qtdPagasEmAtraso ? c.atrasoMedioHistorico / c.qtdPagasEmAtraso : 0;
    const atrasoMedioAtual = c.qtdVencidas ? c.atrasoMedioAtual / c.qtdVencidas : 0;
    const prazoMedioAcordado = c.qtdDuplicatas ? c.prazoMedioAcordado / c.qtdDuplicatas : 0;
    const prazoMedioReal = c.qtdPagas ? c.prazoMedioReal / c.qtdPagas : 0;

    // % no prazo: só faz sentido sobre pagas com datas comparáveis (qtdPagasNoPrazo + qtdPagasEmAtraso)
    const pagasComparaveis = c.qtdPagasNoPrazo + c.qtdPagasEmAtraso;
    const percentualNoPrazo = pagasComparaveis > 0
      ? (c.qtdPagasNoPrazo / pagasComparaveis) * 100
      : 100; // sem comparáveis: assume neutro positivo (não penaliza por falta de dado)

    /* =========================================================
     * SCORE (0-100) — comportamento real
     *  Começa em 100 e SUBTRAI penalidades concretas:
     *  - % pago em atraso histórico (peso 0.4, máx 30)
     *  - Atraso médio do histórico em dias (peso 0.4, máx 25)
     *  - % de duplicatas hoje vencidas (peso 0.7, máx 35)
     *  - Maior atraso atual (peso 0.2, máx 25)
     *  Cliente sem qualquer histórico/atraso => 100 (EXCELENTE).
     * ========================================================= */
    let score = 100;

    // 1) Histórico: percentual de pagamentos com atraso
    if (pagasComparaveis > 0) {
      const pctAtrasoHist = (c.qtdPagasEmAtraso / pagasComparaveis) * 100;
      score -= Math.min(30, pctAtrasoHist * 0.4);
    }

    // 2) Magnitude do atraso histórico
    score -= Math.min(25, atrasoMedioHistorico * 0.4);

    // 3) Situação ATUAL: % vencidas sobre o total emitido
    if (c.qtdDuplicatas > 0) {
      const pctVencidasAtual = (c.qtdVencidas / c.qtdDuplicatas) * 100;
      score -= Math.min(35, pctVencidasAtual * 0.7);
    }

    // 4) Severidade do atraso atual (maior atraso vigente)
    score -= Math.min(25, c.maiorAtraso * 0.2);

    score = Math.max(0, Math.min(100, Math.round(score)));

    /* =========================================================
     * CLASSIFICAÇÃO — só vai para CRITICO/ATENCAO se houver
     * evidência real de mau pagamento. Cliente sem vencidas
     * e sem histórico de atraso é, no mínimo, BOM.
     * ========================================================= */
    let classificacao = classificar(score);
    const semAtrasoReal =
      c.qtdVencidas === 0 &&
      c.qtdPagasEmAtraso === 0 &&
      atrasoMedioHistorico === 0 &&
      c.maiorAtraso === 0;

    if (semAtrasoReal) {
      // Sem nenhuma evidência de inadimplência → no mínimo BOM
      classificacao = score >= 85 ? 'EXCELENTE' : 'BOM';
    } else if (classificacao === 'CRITICO' && c.qtdVencidas === 0 && atrasoMedioHistorico < 15) {
      // Sem vencidas atuais e atraso histórico baixo → rebaixa para ATENCAO no máximo
      classificacao = 'ATENCAO';
    }

    return {
      ...c,
      atrasoMedioHistorico,
      atrasoMedioAtual,
      prazoMedioAcordado,
      prazoMedioReal,
      percentualNoPrazo,
      pontualidadeScore: score,
      classificacao,
    };
  }).sort((a, b) => b.totalAberto - a.totalAberto);
}

export function calcAlertasCriticos(
  kpis: ResumoKPIs,
  duplicatas: DuplicataAgregada[],
  clientes: ClienteAnalytics[],
): AlertaCritico[] {
  const alertas: AlertaCritico[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const vencemHoje = duplicatas.filter((d) => d.situacao === 'vence_hoje');
  if (vencemHoje.length > 0) {
    const total = vencemHoje.reduce((s, d) => s + toCarteiraValor(d.valor), 0);
    alertas.push({
      id: 'venc-hoje',
      tipo: 'VENCIMENTO_HOJE',
      titulo: `${vencemHoje.length} título(s) vencem hoje`,
      descricao: `Acompanhe a baixa para evitar entrada em inadimplência amanhã.`,
      valor: total,
      severidade: 'media',
    });
  }

  if (kpis.totalVencido > 0) {
    const top3 = clientes
      .filter((c) => c.totalVencido > 0)
      .sort((a, b) => b.totalVencido - a.totalVencido)
      .slice(0, 3);
    const somaTop3 = top3.reduce((s, c) => s + c.totalVencido, 0);
    const pct = (somaTop3 / kpis.totalVencido) * 100;
    if (pct >= 50 && top3.length > 0) {
      alertas.push({
        id: 'concentracao',
        tipo: 'CONCENTRACAO',
        titulo: 'Risco concentrado em poucos clientes',
        descricao: `${top3.length} cliente(s) representam ${pct.toFixed(0)}% do total vencido. Foque a cobrança neles.`,
        valor: somaTop3,
        severidade: 'alta',
      });
    }
  }

  const agingExtremo = duplicatas
    .filter((d) => d.situacao === 'vencida' && d.diasAtraso > 90)
    .reduce((s, d) => s + toCarteiraValor(d.valor), 0);
  if (agingExtremo > 0) {
    alertas.push({
      id: 'aging-extremo',
      tipo: 'AGING_EXTREMO',
      titulo: 'Títulos com atraso superior a 90 dias',
      descricao: 'Avaliar baixa contábil ou cobrança jurídica destes valores.',
      valor: agingExtremo,
      severidade: 'alta',
    });
  }

  const criticos = clientes.filter((c) => c.classificacao === 'CRITICO' && c.totalAberto > 0).slice(0, 3);
  if (criticos.length > 0) {
    alertas.push({
      id: 'cliente-critico',
      tipo: 'CLIENTE_RISCO',
      titulo: `${criticos.length} cliente(s) com classificação crítica`,
      descricao: criticos.map((c) => c.cliente).join(' • '),
      valor: criticos.reduce((s, c) => s + c.totalAberto, 0),
      severidade: 'alta',
    });
  }

  return alertas;
}

export function useResumoComputed(filters: ResumoFilters) {
  const { records, isLoading, error, offlineError, hasSource, refetch } = useResumoData();

  const computed = useMemo(() => {
    const duplicatas = aggregateDuplicatas(records);
    const pedidos = aggregatePedidosAbertos(records);
    const kpis = calcKPIs(duplicatas, pedidos);
    const clientes = aggregateByCliente(duplicatas);
    const filtradas = applyFilters(duplicatas, filters);
    const empresasDisponiveis = Array.from(
      new Set(records.map((r) => r.NomeEmpresa).filter(Boolean)),
    ).sort();

    // novas análises
    const aging = calcAging(duplicatas);
    const projecao = calcProjecaoRecebimentos(duplicatas);
    const pdd = calcPDD(duplicatas);
    const clientesAnalytics = calcClienteAnalytics(duplicatas);
    const alertas = calcAlertasCriticos(kpis, duplicatas, clientesAnalytics);
    const funil = calcFunilCarteira(duplicatas, pedidos);

    return {
      duplicatas, pedidos, kpis, clientes, filtradas, empresasDisponiveis,
      aging, projecao, pdd, clientesAnalytics, alertas, funil,
    };
  }, [records, filters]);

  return { ...computed, isLoading, error, offlineError, hasSource, refetch, totalRecords: records.length };
}
