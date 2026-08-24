import { useQuery } from '@tanstack/react-query';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';

export interface DuplicataRecord {
  [key: string]: unknown;
  CodEmpresa_bi: number | string;
  Empresa: string;
  Tipo: 'RECEBER' | 'PAGAR' | string;
  Origem: string; // A RECEBER | RECEBIMENTOS REALIZADOS | A PAGAR | PAGAMENTOS REALIZADOS
  Vendedor: string | null;
  CodCliente: string;
  Fonte: string;
  Cliente: string;
  CodClienteRazao: string;
  CodBanco: number | string;
  Banco: string;
  Conta: string;
  Complemento: string | null;
  Observacao: string | null;
  CodDuplicata: string;
  DataFluxo: string | null;
  DataDCTO: string | null;
  DataEmissao: string | null;
  DataVencimento: string | null;
  DataPagamento: string | null;
  ValorDuplicata: number | null;
  SaldoAberto?: number | null;
  ValorSaldo?: number | null;
  Saldo?: number | null;
  ValorJuros: number | null;
  ValorDesconto: number | null;
  ValorRecebimento: number | null;
  ValorRecebido?: number | null;
  ValorPago?: number | null;
  DataBaixa?: string | null;
  DataQuitacao?: string | null;
  DataCancelamento?: string | null;
  Status?: string | null;
  Situacao?: string | null;
  CodDepartamento: string | null;
  Departamento: string | null;
  CodConta: number | string | null;
  Descricao: string | null;
}

export interface DuplicatasFetchAudit {
  empresa: string | number | null;
  fonte: 'endpoint' | 'json' | 'json_fallback';
  data_ini?: string;
  data_fim?: string;
  endpointPrincipal?: string | null;
  endpointFinal?: string;
  endpointPathConfigurado?: string | null;
  jsonPathConfigurado?: string | null;
  usarVpsIntermediaria?: boolean;
  vpsBaseUrl?: string | null;
  vpsClienteIdentificador?: string | null;
  queryParams?: Record<string, string>;
  endpoint: string;
  path: string;
  statusHttp: number | null;
  registrosBrutos: number;
  camposDetectados: Record<string, string | null>;
  responseBody?: string;
  motivoFallback?: string;
}

type DuplicataArray = DuplicataRecord[] & { __audit?: DuplicatasFetchAudit };

function pickField(raw: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const key of aliases) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') return raw[key];
  }

  const normalizedMap = new Map<string, string>();
  for (const key of Object.keys(raw)) {
    normalizedMap.set(key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''), key);
  }

  for (const alias of aliases) {
    const normalizedAlias = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = normalizedMap.get(normalizedAlias);
    if (found && raw[found] !== undefined && raw[found] !== null && String(raw[found]).trim() !== '') return raw[found];
  }

  return null;
}

function detectedField(raw: Record<string, unknown>, aliases: readonly string[]): string | null {
  for (const key of aliases) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') return key;
  }
  const normalizedMap = new Map<string, string>();
  for (const key of Object.keys(raw)) {
    normalizedMap.set(key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''), key);
  }
  for (const alias of aliases) {
    const normalizedAlias = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = normalizedMap.get(normalizedAlias);
    if (found && raw[found] !== undefined && raw[found] !== null && String(raw[found]).trim() !== '') return found;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

const FIELD_ALIASES = {
  codEmpresa: ['CodEmpresa_bi', 'cod_empresa_bi', 'CodEmpresaBI', 'CodEmpresa', 'codEmpresa'],
  empresa: ['Empresa', 'NomeEmpresa', 'empresa', 'nome_empresa'],
  tipo: ['Tipo', 'tipo', 'TipoTitulo', 'TipoMovimento'],
  origem: ['Origem', 'origem', 'TipoOrigem'],
  vendedor: ['Vendedor', 'vendedor', 'NomeVendedor', 'VendInterno'],
  codCliente: ['CodCliente', 'cod_cliente', 'CodigoCliente', 'Código Cliente', 'ClienteCodigo'],
  cliente: ['Cliente', 'cliente', 'NomeCliente', 'RazaoSocial', 'Razão Social'],
  codDuplicata: ['CodDuplicata', 'Duplicata', 'NumeroDuplicata', 'NumeroTitulo', 'Id', 'id', 'Titulo', 'Parcela'],
  vencimento: ['DataVencimento', 'data_vencimento', 'DtVencimento', 'Vencimento', 'Data Vencto', 'DataVencto'],
  pagamento: ['DataPagamento', 'data_pagamento', 'DtPagamento', 'Pagamento'],
  baixa: ['DataBaixa', 'data_baixa', 'DtBaixa', 'Baixa'],
  quitacao: ['DataQuitacao', 'DataQuitação', 'data_quitacao', 'DtQuitacao'],
  cancelamento: ['DataCancelamento', 'data_cancelamento', 'DtCancelamento'],
  emissao: ['DataEmissao', 'data_emissao', 'DtEmissao', 'Emissao'],
  valor: ['ValorDuplicata', 'Valor', 'valor', 'ValorTitulo', 'ValorOriginal', 'ValorParcela', 'VlrDuplicata'],
  saldo: ['SaldoAberto', 'Saldo', 'ValorSaldo', 'SaldoTitulo', 'ValorEmAberto', 'VlrSaldo', 'SaldoReceber'],
  recebido: ['ValorRecebimento', 'ValorRecebido', 'ValorPago', 'ValorBaixado', 'VlrRecebido'],
  status: ['Status', 'Situacao', 'Situação', 'situacao', 'status'],
} as const;

function normalizeDuplicataRecord(rawValue: unknown): DuplicataRecord {
  const raw = (rawValue ?? {}) as Record<string, unknown>;
  const valor = toNumber(pickField(raw, FIELD_ALIASES.valor));
  const saldo = toNumber(pickField(raw, FIELD_ALIASES.saldo));
  const recebido = toNumber(pickField(raw, FIELD_ALIASES.recebido));
  const tipoRaw = String(pickField(raw, FIELD_ALIASES.tipo) ?? '').trim();
  const origemRaw = String(pickField(raw, FIELD_ALIASES.origem) ?? '').trim();
  const status = String(pickField(raw, FIELD_ALIASES.status) ?? '').trim() || null;

  return {
    ...raw,
    CodEmpresa_bi: pickField(raw, FIELD_ALIASES.codEmpresa) as string | number || '',
    Empresa: String(pickField(raw, FIELD_ALIASES.empresa) ?? ''),
    Tipo: tipoRaw || (/PAGAR/i.test(origemRaw) ? 'PAGAR' : 'RECEBER'),
    Origem: origemRaw,
    Vendedor: (pickField(raw, FIELD_ALIASES.vendedor) as string | null) ?? null,
    CodCliente: String(pickField(raw, FIELD_ALIASES.codCliente) ?? ''),
    Fonte: String(raw.Fonte ?? raw.fonte ?? ''),
    Cliente: String(pickField(raw, FIELD_ALIASES.cliente) ?? ''),
    CodClienteRazao: String(raw.CodClienteRazao ?? raw.cod_cliente_razao ?? ''),
    CodBanco: (raw.CodBanco as string | number | null) ?? '',
    Banco: String(raw.Banco ?? raw.banco ?? ''),
    Conta: String(raw.Conta ?? raw.conta ?? ''),
    Complemento: (raw.Complemento as string | null) ?? null,
    Observacao: (raw.Observacao as string | null) ?? null,
    CodDuplicata: String(pickField(raw, FIELD_ALIASES.codDuplicata) ?? ''),
    DataFluxo: (raw.DataFluxo as string | null) ?? null,
    DataDCTO: (raw.DataDCTO as string | null) ?? null,
    DataEmissao: (pickField(raw, FIELD_ALIASES.emissao) as string | null) ?? null,
    DataVencimento: (pickField(raw, FIELD_ALIASES.vencimento) as string | null) ?? null,
    DataPagamento: (pickField(raw, FIELD_ALIASES.pagamento) as string | null) ?? null,
    DataBaixa: (pickField(raw, FIELD_ALIASES.baixa) as string | null) ?? null,
    DataQuitacao: (pickField(raw, FIELD_ALIASES.quitacao) as string | null) ?? null,
    DataCancelamento: (pickField(raw, FIELD_ALIASES.cancelamento) as string | null) ?? null,
    ValorDuplicata: valor,
    SaldoAberto: saldo,
    ValorSaldo: saldo,
    Saldo: saldo,
    ValorJuros: toNumber(raw.ValorJuros),
    ValorDesconto: toNumber(raw.ValorDesconto),
    ValorRecebimento: recebido,
    ValorRecebido: recebido,
    ValorPago: toNumber(raw.ValorPago),
    Status: status,
    Situacao: status,
    CodDepartamento: (raw.CodDepartamento as string | null) ?? null,
    Departamento: (raw.Departamento as string | null) ?? null,
    CodConta: (raw.CodConta as string | number | null) ?? null,
    Descricao: (raw.Descricao as string | null) ?? null,
  };
}

function detectCampos(raw: unknown): Record<string, string | null> {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    cliente: detectedField(r, FIELD_ALIASES.cliente),
    codCliente: detectedField(r, FIELD_ALIASES.codCliente),
    duplicata: detectedField(r, FIELD_ALIASES.codDuplicata),
    vencimento: detectedField(r, FIELD_ALIASES.vencimento),
    pagamento: detectedField(r, FIELD_ALIASES.pagamento),
    baixa: detectedField(r, FIELD_ALIASES.baixa),
    cancelamento: detectedField(r, FIELD_ALIASES.cancelamento),
    valor: detectedField(r, FIELD_ALIASES.valor),
    saldo: detectedField(r, FIELD_ALIASES.saldo),
    recebido: detectedField(r, FIELD_ALIASES.recebido),
    status: detectedField(r, FIELD_ALIASES.status),
  };
}

function buildDuplicatasQueryParams(dataIni?: string, dataFim?: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (dataIni) params.data_ini = dataIni;
  if (dataFim) params.data_fim = dataFim;
  return params;
}

function appendDateParams(endpointPath: string, dataIni?: string, dataFim?: string): string {
  let path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const queryParams = buildDuplicatasQueryParams(dataIni, dataFim);
  const entries = Object.entries(queryParams);
  if (entries.length === 0) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${new URLSearchParams(queryParams).toString()}`;
}

function getSourceConfigAudit(empresa: any, endpointPath?: string | null, jsonPath?: string | null) {
  return {
    empresa: empresa?.cod_empresa_bi ?? null,
    endpointPrincipal: empresa?.endpoint_url ?? null,
    endpointPathConfigurado: endpointPath ?? null,
    jsonPathConfigurado: jsonPath ?? null,
    usarVpsIntermediaria: Boolean(empresa?.usar_vps_intermediaria),
    vpsBaseUrl: empresa?.vps_base_url ?? null,
    vpsClienteIdentificador: empresa?.vps_cliente_identificador ?? null,
  };
}

async function fetchFromStorage(
  path: string,
  audit?: Partial<DuplicatasFetchAudit>,
): Promise<DuplicataArray> {
  const clean = path.replace(/^storage:/, '').replace(/^\/+/, '');
  console.info('[Duplicatas] fonte JSON:', {
    empresaAtiva: audit?.empresa ?? null,
    jsonPath: clean,
    motivoFallback: audit?.motivoFallback ?? null,
  });
  const { data, error } = await supabase.storage.from('dados-json').download(clean);
  if (error) throw new Error(`Falha ao baixar JSON: ${error.message}`);
  const text = await data.text();
  const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const parsed = JSON.parse(sanitized);
  if (!Array.isArray(parsed)) throw new Error('JSON precisa ser um array');
  const normalized = parsed.map(normalizeDuplicataRecord) as DuplicataArray;
  normalized.__audit = {
    empresa: audit?.empresa ?? null,
    fonte: audit?.motivoFallback ? 'json_fallback' : 'json',
    data_ini: audit?.data_ini,
    data_fim: audit?.data_fim,
    endpointPrincipal: audit?.endpointPrincipal ?? null,
    endpointFinal: `storage:${clean}`,
    endpointPathConfigurado: audit?.endpointPathConfigurado ?? null,
    jsonPathConfigurado: audit?.jsonPathConfigurado ?? path,
    usarVpsIntermediaria: audit?.usarVpsIntermediaria,
    vpsBaseUrl: audit?.vpsBaseUrl,
    vpsClienteIdentificador: audit?.vpsClienteIdentificador,
    queryParams: audit?.queryParams,
    endpoint: `storage:${clean}`,
    path: clean,
    statusHttp: 200,
    registrosBrutos: parsed.length,
    camposDetectados: detectCampos(parsed[0]),
    motivoFallback: audit?.motivoFallback,
  };
  console.info('[Duplicatas] JSON carregado:', {
    empresaAtiva: normalized.__audit.empresa,
    fonte: normalized.__audit.fonte,
    registrosRetornados: normalized.length,
    jsonPath: clean,
  });
  return normalized;
}

/**
 * Rotas conhecidas de duplicatas/contas a receber na API do ERP.
 * A rota configurada é sempre tentada primeiro; as demais servem de fallback
 * apenas quando a origem responde 404 (rota inexistente).
 */
const DUPLICATAS_PATH_CANDIDATES = [
  '/financeiro/duplicatas',
  '/financeiro/',
];

function buildDuplicatasPathCandidates(endpointPath: string): string[] {
  const norm = (p: string) => (p.startsWith('/') ? p : `/${p}`);
  const configured = norm(endpointPath.trim());
  const isGenericFinanceiro = configured.replace(/\/+$/, '') === '/financeiro';
  const list = isGenericFinanceiro
    ? [...DUPLICATAS_PATH_CANDIDATES.filter((p) => p !== configured), configured]
    : [configured, ...DUPLICATAS_PATH_CANDIDATES.filter((p) => p !== configured)];
  return Array.from(new Set(list));
}

/** Tenta a rota configurada e, em caso de 404, as demais rotas conhecidas de duplicatas. */
async function fetchDuplicatasResolvingPath(
  empresa: any,
  endpointPath: string,
  jsonPath?: string | null,
  dataIni?: string,
  dataFim?: string,
): Promise<DuplicataArray> {
  const candidates = buildDuplicatasPathCandidates(endpointPath);
  const tentativas: { path: string; erro: string }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const isLast = i === candidates.length - 1;
    try {
      return await fetchFromEndpoint(empresa, candidate, isLast ? jsonPath : null, dataIni, dataFim);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      tentativas.push({ path: candidate, erro: msg.slice(0, 200) });
      const is404 = /HTTP:? 404|HTTP 404/.test(msg);
      const isGenericFinanceiro = candidate.replace(/\/+$/, '') === '/financeiro';
      const isGenericServerError = isGenericFinanceiro && /HTTP 5\d\d|erro interno|Internal Server Error/i.test(msg);
      if ((is404 || isGenericServerError) && !isLast) {
        console.warn('[Duplicatas] rota inexistente (404), tentando próxima rota candidata:', {
          rotaTestada: candidate,
          proximaRota: candidates[i + 1],
        });
        continue;
      }
      console.warn('[Duplicatas] fonte indisponível; seguindo com carteira vazia:', {
        empresaAtiva: empresa?.cod_empresa_bi ?? null,
        rotaConfigurada: endpointPath,
        rotasTentadas: tentativas,
      });
      return [] as DuplicataArray;
    }
  }
  console.warn('[Duplicatas] nenhuma rota de duplicatas disponível na API do ERP; carteira vazia.');
  return [] as DuplicataArray;
}

async function fetchFromEndpoint(
  empresa: any,
  endpointPath: string,
  jsonPath?: string | null,
  dataIni?: string,
  dataFim?: string,
): Promise<DuplicataArray> {
  const path = appendDateParams(endpointPath, dataIni, dataFim);
  const queryParams = buildDuplicatasQueryParams(dataIni, dataFim);
  const url = buildApiProxyUrl(empresa, path);
  const proxyUrl = new URL(url);
  const { endpoint, path: finalPath } = proxyUrl.searchParams.has('endpoint')
    ? { endpoint: proxyUrl.searchParams.get('endpoint') || '', path: proxyUrl.searchParams.get('path') || '' }
    : { endpoint: '', path };
  const endpointCompleto = `${endpoint.replace(/\/+$/, '')}${finalPath}`;
  const sourceAudit = getSourceConfigAudit(empresa, endpointPath, jsonPath);
  console.info('[Duplicatas] fonte endpoint:', {
    empresaAtiva: empresa?.cod_empresa_bi ?? null,
    endpointPrincipal: empresa?.endpoint_url ?? null,
    usarVpsIntermediaria: Boolean(empresa?.usar_vps_intermediaria),
    vpsBaseUrl: empresa?.vps_base_url ?? null,
    vpsClienteIdentificador: empresa?.vps_cliente_identificador ?? null,
    endpointPathConfigurado: endpointPath,
    jsonPathConfigurado: jsonPath ?? null,
    endpointFinal: endpointCompleto,
    queryParams,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      signal: controller.signal,
    });
    const text = await res.text();
    console.info('[Duplicatas] status HTTP:', {
      empresaAtiva: empresa?.cod_empresa_bi ?? null,
      endpointFinal: endpointCompleto,
      statusHttp: res.status,
      proxyUpstreamError: res.headers.get('x-proxy-upstream-error') === 'true',
    });
    if (!res.ok || res.headers.get('x-proxy-upstream-error') === 'true') {
      const upstreamStatus = Number(res.headers.get('x-proxy-upstream-status')) || res.status;
      const upstreamBody = res.headers.get('x-proxy-upstream-body') || text;
      if (jsonPath) {
        console.warn('[Duplicatas] endpoint falhou; tentando JSON fallback:', {
          empresaAtiva: empresa?.cod_empresa_bi ?? null,
          endpointFinal: endpointCompleto,
          statusHttp: upstreamStatus,
          jsonPath,
        });
        return fetchFromStorage(jsonPath, {
          ...sourceAudit,
          fonte: 'json_fallback',
          data_ini: dataIni,
          data_fim: dataFim,
          endpoint: endpointCompleto,
          endpointFinal: endpointCompleto,
          path,
          statusHttp: upstreamStatus,
          responseBody: upstreamBody,
          queryParams,
          motivoFallback: `Endpoint retornou HTTP ${upstreamStatus}; usando JSON fallback`,
        });
      }
      console.error('[Duplicatas] erro endpoint:', {
        empresaAtiva: empresa?.cod_empresa_bi ?? null,
        endpoint: endpointCompleto,
        queryParams,
        statusHttp: upstreamStatus,
        responseBody: upstreamBody.slice(0, 2000),
        jsonFallbackDisponivel: false,
        motivoFallback: res.headers.get('x-proxy-upstream-error') === 'true'
          ? 'proxy retornou fallback por erro na origem'
          : 'resposta HTTP inválida da origem',
      });
      throw new Error(
        upstreamStatus >= 500
          ? `Fonte de duplicatas indisponível ou retornando erro. A API do ERP retornou erro interno (HTTP ${upstreamStatus}) na rota de duplicatas. ` +
            `Endpoint: ${endpointCompleto}. Problema na origem (consulta SQL do servidor), não no BI. ` +
            `Retorno: ${upstreamBody.slice(0, 300) || res.statusText}`
          : `Fonte de duplicatas indisponível ou retornando erro. Endpoint testado: ${endpointCompleto}. ` +
            `Status HTTP: ${upstreamStatus}. Retorno: ${upstreamBody.slice(0, 300) || res.statusText}`
      );
    }
    const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const parsed = JSON.parse(sanitized);
    if (!Array.isArray(parsed)) throw new Error('Resposta precisa ser um array');
    const normalized = parsed.map(normalizeDuplicataRecord) as DuplicataArray;
    normalized.__audit = {
      empresa: empresa?.cod_empresa_bi ?? null,
      fonte: 'endpoint',
      data_ini: dataIni,
      data_fim: dataFim,
      ...sourceAudit,
      endpointFinal: endpointCompleto,
      queryParams,
      endpoint: endpointCompleto,
      path,
      statusHttp: res.status,
      registrosBrutos: parsed.length,
      camposDetectados: detectCampos(parsed[0]),
    };
    console.info('[Duplicatas] registros retornados:', {
      empresaAtiva: empresa?.cod_empresa_bi ?? null,
      fonte: 'endpoint',
      endpointFinal: endpointCompleto,
      queryParams,
      statusHttp: res.status,
      quantidadeRegistros: parsed.length,
    });
    return normalized;
  } finally {
    clearTimeout(timer);
  }
}

export interface UseDuplicatasParams {
  dataIni?: string;
  dataFim?: string;
}

export function useDuplicatasData(params: UseDuplicatasParams = {}) {
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();
  const { dataIni, dataFim } = params;

  const effectiveEmpresa = empresa;
  const { hasSearched } = useFinanceiroSearch();

  return useQuery({
    queryKey: ['duplicatas', codEmpresaAtiva, dataIni, dataFim],
    enabled: !!effectiveEmpresa,
    queryFn: async (): Promise<DuplicataRecord[]> => {
      if (!effectiveEmpresa) {
        console.error('[Duplicatas] empresa ativa não resolvida:', { empresaAtiva: codEmpresaAtiva });
        throw new Error(
          `Empresa ativa não identificada (${codEmpresaAtiva ?? 'nenhuma'}). ` +
          'Selecione a empresa para carregar a fonte de duplicatas. Nenhum valor é exibido para evitar mostrar R$ 0 indevidamente.'
        );
      }
      const jsonPath = (effectiveEmpresa as any).json_path_duplicatas as string | null;
      const endpointPath = (effectiveEmpresa as any).endpoint_path_duplicatas as string | null;
      console.info('[Duplicatas] configuração da fonte:', {
        empresaAtiva: codEmpresaAtiva,
        empresaFonte: (effectiveEmpresa as any)?.cod_empresa_bi ?? null,
        endpointPrincipal: (effectiveEmpresa as any)?.endpoint_url ?? null,
        endpointPathDuplicatas: endpointPath ?? null,
        jsonPathDuplicatas: jsonPath ?? null,
        usarVpsIntermediaria: Boolean((effectiveEmpresa as any)?.usar_vps_intermediaria),
        vpsBaseUrl: (effectiveEmpresa as any)?.vps_base_url ?? null,
        vpsClienteIdentificador: (effectiveEmpresa as any)?.vps_cliente_identificador ?? null,
        queryParams: buildDuplicatasQueryParams(dataIni, dataFim),
      });
      let data: DuplicataArray;
      const isEmpresa1001 = String(codEmpresaAtiva) === '1001' || String((effectiveEmpresa as any)?.cod_empresa_bi ?? '') === '1001';
      if (isEmpresa1001 && endpointPath) data = await fetchDuplicatasResolvingPath(effectiveEmpresa, endpointPath, jsonPath, dataIni, dataFim);
      else if (jsonPath) {
        data = await fetchFromStorage(jsonPath, {
          ...getSourceConfigAudit(effectiveEmpresa, endpointPath, jsonPath),
          data_ini: dataIni,
          data_fim: dataFim,
          queryParams: buildDuplicatasQueryParams(dataIni, dataFim),
        });
      }
      else if (endpointPath) data = await fetchDuplicatasResolvingPath(effectiveEmpresa, endpointPath, jsonPath, dataIni, dataFim);
      else throw new Error(`Nenhuma fonte de dados configurada para Duplicatas na empresa fonte ${codEmpresaAtiva}`);
      console.info('[Duplicatas] registros entregues à interface:', {
        empresaAtiva: codEmpresaAtiva,
        fonteUsada: data.__audit?.fonte ?? 'desconhecida',
        endpointFinal: data.__audit?.endpointFinal ?? data.__audit?.endpoint ?? null,
        statusHttp: data.__audit?.statusHttp ?? null,
        quantidadeRegistros: data.length,
        usouJsonFallback: data.__audit?.fonte === 'json_fallback',
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export type StatusVencto = 'EM_DIA' | 'VENCE_HOJE' | 'VENCIDA' | 'PAGA' | 'SEM_VENCTO';

export function getStatusVencto(d: DuplicataRecord, today = new Date()): StatusVencto {
  if (d.DataPagamento) return 'PAGA';
  if (!d.DataVencimento) return 'SEM_VENCTO';
  const venc = new Date(d.DataVencimento);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const v = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate());
  if (v.getTime() === t.getTime()) return 'VENCE_HOJE';
  if (v.getTime() < t.getTime()) return 'VENCIDA';
  return 'EM_DIA';
}
