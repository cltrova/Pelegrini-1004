import { useQuery } from '@tanstack/react-query';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import type { DuplicataRecord } from '@/hooks/useDuplicatasData';

/**
 * Fonte da tela Financeiro > Saldo a Vencer (empresa 1001).
 *
 * Regra obrigatória: NÃO usar mais o endpoint /financeiro/ (duplicatas).
 * Os dados vêm do mesmo endpoint do Comercial: /comercial/pedidos.
 * Os registros são normalizados para o formato consumido pela tela.
 */

const PEDIDOS_PATH = '/comercial/pedidos';

/** Campos que indicam saldo em aberto direto. */
const SALDO_ALIASES = [
  'valor_aberto',
  'saldo_aberto',
  'saldo_a_vencer',
  'valor_a_vencer',
  'valor_pendente',
  'valor_em_aberto',
  'valor_restante',
  'saldo',
] as const;

/** Campos que indicam valor já pago/recebido. */
const PAGO_ALIASES = ['valor_pago', 'valor_recebido', 'valor_baixado', 'valor_quitado'] as const;

/** Campos de valor total do pedido. */
const TOTAL_ALIASES = ['valor_total_pedido', 'valor_liquido', 'valor_bruto', 'valor_total_nf'] as const;

const VENC_ALIASES = [
  'data_vencimento',
  'DataVencimento',
  'Data Vencimento',
  'Data de Vencimento',
  'vencimento',
  'Vencimento',
  'venc',
  'Venc',
  'vcto',
  'Vcto',
  'data_previsao',
  'DataPrevisao',
  'previsao_vencimento',
  'Data Vencto',
  'DataVencto',
  'DtVencimento',
  'Dt Vencimento',
  'dt_vencimento',
  'dt_venc',
  'dt_vcto',
  'dt_vencto',
  'data_vencto',
  'data_vcto',
  'vencto',
  'Vencto',
  'data_parcela',
  'vencimento_parcela',
  'venc_parcela',
  'data_validade',
  'DataValidade',
  'Data Validade',
  'validade',
  'Validade',
] as const;

const VENC_FALLBACK_ALIASES = [
  'data_prevista_recebimento',
  'DataPrevistaRecebimento',
  'previsao_recebimento',
  'PrevisaoRecebimento',
  'data_recebimento_previsto',
  'DataRecebimentoPrevisto',
  'data_prevista_pagamento',
  'DataPrevistaPagamento',
] as const;

const PARCELA_ALIASES = [
  'parcela',
  'Parcela',
  'numero_parcela',
  'NumeroParcela',
  'num_parcela',
  'NumParcela',
  'seq_parcela',
  'SeqParcela',
  'nro_parcela',
  'NroParcela',
  'parcela_atual',
  'ParcelaAtual',
] as const;

const DOC_FINANCEIRO_ALIASES = [
  'cod_pedido',
  'CodPedido',
  'Pedido',
  'pedido',
  'CodDuplicata',
  'Duplicata',
  'NumeroDuplicata',
  'NumeroTitulo',
  'NumeroDocumento',
] as const;

const NF_ALIASES = [
  'num_nf',
  'NumNF',
  'NF',
  'NotaFiscal',
  'NotaFisacal',
  'Nota Fiscal',
  'numero_nf',
  'NumeroNF',
] as const;

const COD_CLIENTE_ALIASES = [
  'cod_cliente',
  'CodCliente',
  'codigo_cliente',
  'CodigoCliente',
  'cod_cliente_razao',
  'CodClienteRazao',
] as const;

const CLIENTE_ALIASES = [
  'cliente',
  'Cliente',
  'nome_cliente',
  'NomeCliente',
  'razao_social',
  'RazaoSocial',
  'nome_fantasia',
] as const;

const DATA_EMISSAO_ALIASES = ['data_pedido', 'DataPedido', 'data_faturamento', 'DataFaturamento'] as const;

function norm(key: string): string {
  return key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findKey(raw: Record<string, unknown>, aliases: readonly string[]): string | null {
  const map = new Map<string, string>();
  for (const k of Object.keys(raw)) map.set(norm(k), k);
  for (const alias of aliases) {
    const found = map.get(norm(alias));
    if (found) return found;
  }
  return null;
}

function findKeyAcrossRows(rows: Record<string, unknown>[], aliases: readonly string[]): string | null {
  for (const row of rows) {
    const found = findKey(row, aliases);
    if (found) return found;
  }
  return null;
}

function readAliasedValue(
  raw: Record<string, unknown>,
  preferredKey: string | null,
  aliases: readonly string[],
): unknown {
  if (preferredKey) {
    const value = raw[preferredKey];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  const rowKey = findKey(raw, aliases);
  return rowKey ? raw[rowKey] : null;
}

function normalizarDocumento(value: unknown): string {
  return String(value ?? '').trim().replace(/^0+/, '').toUpperCase();
}

export function enrichPedidoComDuplicataFinanceira(
  pedido: Record<string, unknown>,
  duplicatas: Record<string, unknown>[],
): { vencimento: unknown; numNF: unknown; parcela: unknown } | null {
  const pedidoKeys = [
    normalizarDocumento(readAliasedValue(pedido, null, DOC_FINANCEIRO_ALIASES)),
    normalizarDocumento(readAliasedValue(pedido, null, NF_ALIASES)),
  ].filter(Boolean);

  if (pedidoKeys.length === 0 || duplicatas.length === 0) return null;

  for (const duplicata of duplicatas) {
    const duplicataKeys = [
      normalizarDocumento(readAliasedValue(duplicata, null, DOC_FINANCEIRO_ALIASES)),
      normalizarDocumento(readAliasedValue(duplicata, null, NF_ALIASES)),
    ].filter(Boolean);

    if (!duplicataKeys.some((key) => pedidoKeys.includes(key))) continue;

    return {
      vencimento: readAliasedValue(duplicata, null, VENC_ALIASES),
      numNF: readAliasedValue(duplicata, null, NF_ALIASES),
      parcela: readAliasedValue(duplicata, null, PARCELA_ALIASES),
    };
  }

  return null;
}

function appendDateParams(path: string, dataIni?: string, dataFim?: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const query = new URLSearchParams();
  if (dataIni) query.set('data_ini', dataIni);
  if (dataFim) query.set('data_fim', dataFim);
  return query.toString() ? `${normalized}?${query.toString()}` : normalized;
}

async function fetchDuplicatasParaVencimento(
  empresa: NonNullable<ReturnType<typeof useEmpresaAtiva>['empresa']>,
  dataIni?: string,
  dataFim?: string,
): Promise<Record<string, unknown>[]> {
  const configured = String((empresa as unknown as Record<string, unknown>).endpoint_path_duplicatas ?? '').trim();
  const candidates = Array.from(new Set([
    configured || '/financeiro/duplicatas',
    '/financeiro/duplicatas',
    '/financeiro/',
  ]));

  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = buildApiProxyUrl(empresa, appendDateParams(candidate, dataIni, dataFim));
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const text = await res.text();
      if (!res.ok || res.headers.get('x-proxy-upstream-error') === 'true') {
        console.warn('[SaldoAVencer][Vencimentos] fonte financeira indisponível:', {
          rota: candidate,
          status: res.headers.get('x-proxy-upstream-status') ?? res.status,
          retorno: (res.headers.get('x-proxy-upstream-body') || text).slice(0, 200),
        });
        continue;
      }
      const parsed = JSON.parse(text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''));
      return Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[])
        : Array.isArray((parsed as { data?: unknown })?.data)
          ? ((parsed as { data: Record<string, unknown>[] }).data)
          : [];
    } catch (err) {
      console.warn('[SaldoAVencer][Vencimentos] erro ao consultar fonte financeira:', {
        rota: candidate,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return [];
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusNorm(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

export interface SaldoPedidosAudit {
  urlFinal: string;
  registrosBrutos: number;
  camposSaldoDetectados: {
    saldoDireto: string | null;
    valorPago: string | null;
    valorTotal: string | null;
    vencimento: string | null;
    vencimentoFallback?: string | null;
  };
  camposDisponiveis: string[];
  registrosComSaldo: number;
  totalAVencer: number;
  clientesDistintos: number;
  pedidosEmAberto: number;
  semCamposSaldo: boolean;
}

export type SaldoPedidosArray = DuplicataRecord[] & { __audit?: SaldoPedidosAudit };

export interface UsePedidosSaldoParams {
  dataIni?: string;
  dataFim?: string;
}

/** Pedido considerado quitado/encerrado — fora do saldo a vencer. */
function isEncerrado(status: string): boolean {
  // Faturado ainda pode estar pendente de recebimento; pagamento/baixa é que encerra o saldo.
  return /PAG|QUIT|BAIX|LIQUID|CANCEL|DEVOLV/.test(status);
}

export function usePedidosSaldoAVencer(params: UsePedidosSaldoParams = {}) {
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();
  const { dataIni, dataFim } = params;
  const { hasSearched } = useFinanceiroSearch();

  return useQuery({
    queryKey: ['saldo-a-vencer-pedidos', codEmpresaAtiva, dataIni, dataFim],
    enabled: !!empresa,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<SaldoPedidosArray> => {
      if (!empresa) {
        throw new Error(
          `Empresa ativa não identificada (${codEmpresaAtiva ?? 'nenhuma'}). Selecione a empresa para carregar os pedidos.`,
        );
      }

      const query = new URLSearchParams();
      if (empresa.cod_empresa_bi) query.set('cod_empresa_bi', String(empresa.cod_empresa_bi));
      if (dataIni) query.set('data_ini', dataIni);
      if (dataFim) query.set('data_fim', dataFim);
      const path = query.toString() ? `${PEDIDOS_PATH}?${query.toString()}` : PEDIDOS_PATH;
      const url = buildApiProxyUrl(empresa, path);

      console.info('[1001][SaldoAVencer][Fonte] URL final chamada:', url, { path, params: Object.fromEntries(query) });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      let parsed: unknown;
      try {
        const res = await fetch(url, { signal: controller.signal });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`Falha ao carregar /comercial/pedidos (HTTP ${res.status}): ${text.slice(0, 200)}`);
        }
        parsed = JSON.parse(text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''));
      } finally {
        clearTimeout(timer);
      }

      const rows: Record<string, unknown>[] = Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[])
        : Array.isArray((parsed as { data?: unknown })?.data)
          ? ((parsed as { data: Record<string, unknown>[] }).data)
          : [];

      const first = rows[0] ?? {};
      const camposDisponiveis = Object.keys(first);
      const keySaldo = findKeyAcrossRows(rows, SALDO_ALIASES);
      const keyPago = findKeyAcrossRows(rows, PAGO_ALIASES);
      const keyTotal = findKeyAcrossRows(rows, TOTAL_ALIASES);
      const keyVenc = findKeyAcrossRows(rows, VENC_ALIASES);
      const keyVencFallback = findKeyAcrossRows(rows, VENC_FALLBACK_ALIASES);
      const keyStatus = findKeyAcrossRows(rows, ['status_pedido', 'status', 'situacao']);

      console.info('[1001][SaldoAVencer][Fonte] quantidade bruta retornada:', rows.length);
      console.info('[1001][SaldoAVencer][Fonte] campos detectados para saldo:', {
        saldoDireto: keySaldo,
        valorPago: keyPago,
        valorTotal: keyTotal,
        vencimento: keyVenc,
        vencimentoFallback: keyVencFallback,
        status: keyStatus,
      });
      console.info('[1001][SaldoAVencer][Fonte] campos disponíveis no 1º registro:', camposDisponiveis);

      const semCamposSaldo = !keySaldo && !keyTotal;
      const duplicatasFinanceiras = await fetchDuplicatasParaVencimento(empresa, dataIni, dataFim);
      console.info('[1001][SaldoAVencer][Vencimentos] duplicatas para cruzamento:', {
        registros: duplicatasFinanceiras.length,
        camposPrimeiroRegistro: Object.keys(duplicatasFinanceiras[0] ?? {}),
      });

      const normalizados: DuplicataRecord[] = [];
      for (const raw of rows) {
        const statusRaw = readAliasedValue(raw, keyStatus, ['status_pedido', 'status', 'situacao']);
        const status = statusNorm(statusRaw);
        const codCliente = String(readAliasedValue(raw, null, COD_CLIENTE_ALIASES) ?? '').trim();
        const cliente = String(readAliasedValue(raw, null, CLIENTE_ALIASES) ?? '').trim();
        if (!codCliente && !cliente) continue;

        let saldo = 0;
        const saldoRaw = readAliasedValue(raw, keySaldo, SALDO_ALIASES);
        const totalRaw = readAliasedValue(raw, keyTotal, TOTAL_ALIASES);
        const pagoRaw = readAliasedValue(raw, keyPago, PAGO_ALIASES);
        if (saldoRaw !== null) {
          saldo = toNumber(saldoRaw);
        } else if (totalRaw !== null) {
          // Sem campo direto: pedido em aberto = total - pago (quando existir).
          if (isEncerrado(status)) continue;
          saldo = toNumber(totalRaw) - toNumber(pagoRaw);
        }
        if (isEncerrado(status) && !keySaldo) continue;
        if (!(saldo > 0)) continue;

        const vencimento =
          readAliasedValue(raw, keyVenc, VENC_ALIASES) ??
          readAliasedValue(raw, keyVencFallback, VENC_FALLBACK_ALIASES);
        const dadosFinanceiros = vencimento ? null : enrichPedidoComDuplicataFinanceira(raw, duplicatasFinanceiras);
        const dataEmissao = readAliasedValue(raw, null, DATA_EMISSAO_ALIASES);
        const numNF = readAliasedValue(raw, null, NF_ALIASES) ?? dadosFinanceiros?.numNF ?? null;
        const parcela = readAliasedValue(raw, null, PARCELA_ALIASES) ?? dadosFinanceiros?.parcela ?? null;

        normalizados.push({
          CodEmpresa_bi: (raw.CodEmpresa_bi ?? raw.cod_empresa_bi ?? empresa.cod_empresa_bi) as string | number,
          Empresa: String(raw.empresa ?? raw.Empresa ?? ''),
          Tipo: 'RECEBER',
          Origem: 'A RECEBER',
          Vendedor: (raw.vendedor ?? raw.Vendedor ?? null) as string | null,
          CodCliente: codCliente || cliente,
          Fonte: '/comercial/pedidos',
          Cliente: cliente || codCliente,
          CodClienteRazao: cliente || codCliente,
          CodBanco: '',
          Banco: '',
          Conta: '',
          Complemento: null,
          Observacao: null,
          CodDuplicata: String(raw.cod_pedido ?? raw.CodPedido ?? raw.num_nf ?? ''),
          DataFluxo: null,
          DataDCTO: null,
          DataEmissao: (dataEmissao ?? null) as string | null,
          DataVencimento: (vencimento ?? dadosFinanceiros?.vencimento ?? null) as string | null,
          DataPagamento: null,
          ValorDuplicata: saldo,
          SaldoAberto: saldo,
          ValorJuros: null,
          ValorDesconto: null,
          ValorRecebimento: pagoRaw !== null ? toNumber(pagoRaw) : null,
          CodDepartamento: null,
          Departamento: null,
          CodConta: null,
          Descricao: null,
          Status: String(statusRaw ?? 'Pendente'),
          NumNF: numNF as string | number | null,
          Pedido: (raw.cod_pedido ?? null) as string | number | null,
          Parcela: parcela as string | number | null,
        });
      }

      const total = normalizados.reduce((s, d) => s + toNumber(d.SaldoAberto), 0);
      const clientes = new Set(normalizados.map((d) => String(d.CodCliente)));
      const pedidos = new Set(normalizados.map((d) => `${d.CodCliente}|${d.CodDuplicata}|${d.Parcela ?? ''}`));

      const out = normalizados as SaldoPedidosArray;
      out.__audit = {
        urlFinal: url,
        registrosBrutos: rows.length,
        camposSaldoDetectados: {
          saldoDireto: keySaldo,
          valorPago: keyPago,
          valorTotal: keyTotal,
          vencimento: keyVenc,
          vencimentoFallback: keyVencFallback,
        },
        camposDisponiveis,
        registrosComSaldo: normalizados.length,
        totalAVencer: total,
        clientesDistintos: clientes.size,
        pedidosEmAberto: pedidos.size,
        semCamposSaldo,
      };

      console.info('[1001][SaldoAVencer][Fonte] resumo:', {
        quantidadeAposFiltroSaldo: normalizados.length,
        totalAVencer: total,
        clientesDistintos: clientes.size,
        pedidosParcelasEmAberto: pedidos.size,
        semCamposSaldo,
      });

      return out;
    },
  });
}
