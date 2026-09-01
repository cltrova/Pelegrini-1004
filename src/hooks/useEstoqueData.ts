import { useQuery } from '@tanstack/react-query';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import { supabase } from '@/integrations/supabase/client';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { EstoqueRecord, GiroRecord } from '@/types/estoque';
import { filtrarEstoqueCasaChevrolet10041 } from '@/utils/estoque10041';

type EstoqueApiRow = Record<string, unknown>;

function parseEstoqueRows(payload: unknown): EstoqueApiRow[] {
  if (!Array.isArray(payload)) {
    throw new Error('Formato inesperado na fonte de estoque');
  }
  return payload.filter((row): row is EstoqueApiRow => Boolean(row) && typeof row === 'object');
}

async function fetchFromStorage(storagePath: string): Promise<EstoqueApiRow[]> {
  console.log(`[Estoque] Buscando do storage: ${storagePath}`);
  const { data, error } = await supabase.storage
    .from('dados-json')
    .download(storagePath);
  if (error) {
    console.error('[Estoque] Erro ao baixar do storage:', error);
    throw error;
  }
  const text = await data.text();
  return parseEstoqueRows(JSON.parse(text));
}

async function fetchFromEndpoint(
  empresa: Empresa,
  endpointPath: string
): Promise<EstoqueApiRow[]> {
  const fullUrl = buildApiProxyUrl(empresa, endpointPath);

  console.log(`[Estoque] Buscando do endpoint: ${fullUrl}`);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    clearTimeout(timeout);
    if (!response.ok) {
      if (response.status >= 500) {
        console.warn(`[Estoque] Endpoint indisponível (${response.status}); retornando lista vazia para manter a tela estável.`);
        return [];
      }
      throw new Error(`Erro do endpoint: ${response.status}`);
    }
    return parseEstoqueRows(await response.json());
  } catch (e) {
    clearTimeout(timeout);
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      console.warn('[Estoque] Falha temporária no endpoint; retornando lista vazia para manter a tela estável.', e);
      return [];
    }
    throw e;
  }
}

async function fetchEstoqueSource(
  empresa: Empresa,
  type: 'giro' | 'consolidado' | 'detalhado'
): Promise<EstoqueApiRow[]> {
  const jsonKey = `json_path_estoque_${type}` as keyof Empresa;
  const endpointKey = `endpoint_path_estoque_${type}` as keyof Empresa;

  const jsonPath = empresa[jsonKey] as string | null;
  const endpointPath = empresa[endpointKey] as string | null;

  // JSON tem prioridade — strip "storage:" prefix
  if (jsonPath?.startsWith('storage:')) {
    const storagePath = jsonPath.replace('storage:', '');
    return fetchFromStorage(storagePath);
  }
  if (jsonPath) {
    return fetchFromStorage(jsonPath);
  }

  if (endpointPath && (empresa.endpoint_url || empresa.usar_vps_intermediaria)) {
    let finalPath = endpointPath;
    if (type === 'giro' && !/[?&]data_ini=/.test(endpointPath)) {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const sep = endpointPath.includes('?') ? '&' : '?';
      finalPath = `${endpointPath}${sep}data_ini=${fmt(inicio)}&data_fim=${fmt(hoje)}`;
    }
    return fetchFromEndpoint(empresa, finalPath);
  }


  console.warn(`[Estoque] Nenhuma fonte configurada para ${type}`);
  return [];
}

function normalizeBranchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isGiroRowFromActiveBranch(row: GiroRecord, codEmpresaAtiva?: string | null): boolean {
  const activeCode = String(codEmpresaAtiva ?? '').trim();
  const rowCode = String(row.cod_empresa_bi ?? '').trim();
  const isChevrolet = normalizeBranchText(row.empresa).includes('CHEVROLET');

  if (activeCode === '10041') {
    return rowCode === '10041' || (!rowCode && isChevrolet);
  }

  if (activeCode === '1004') {
    return rowCode !== '10041' && !isChevrolet;
  }

  return true;
}

export function buildEstoqueFallbackFromGiro(
  giroRows: GiroRecord[],
  codEmpresaAtiva?: string | null,
): EstoqueRecord[] {
  const latestByProduct = new Map<string, GiroRecord>();

  giroRows
    .filter((row) => isGiroRowFromActiveBranch(row, codEmpresaAtiva))
    .forEach((row) => {
      const key = `${row.cod_empresa}:${row.cod_produto}`;
      const current = latestByProduct.get(key);
      if (!current || row.data_movimento > current.data_movimento) {
        latestByProduct.set(key, row);
      }
    });

  const activeCode = Number(codEmpresaAtiva) || 0;

  return [...latestByProduct.values()].map((row) => {
    const quantity = Number(row.quantidade_estoque) || 0;
    const stockValue = Number(row.valor_estoque) || 0;
    const estimatedCost = quantity !== 0 ? stockValue / quantity : 0;
    const movementDate = row.data_movimento || null;
    const hasSale = Number(row.saida_venda) > 0;
    const hasPurchase = Number(row.entrada_compra) > 0;
    const hasTransfer = Number(row.saida_transferencia) > 0 || Number(row.entrada_transferencia) > 0;

    return {
      cod_empresa_bi: Number(row.cod_empresa_bi) || activeCode,
      cod_empresa: row.cod_empresa,
      empresa: row.empresa,
      cod_produto: row.cod_produto,
      produto: row.produto,
      cod_fabricante: row.cod_fabricante,
      cod_fornecedor: '',
      cod_grupo_produto: row.cod_grupo,
      grupo: row.grupo,
      cod_marca_produto: row.cod_marca,
      marca: row.marca,
      cod_linha: row.cod_linha || '',
      linha: row.linha,
      nr_fabricante: row.cod_fabricante,
      nr_original: '',
      aplicacao_produto: '',
      classe_abc: '',
      quantidade_estoque: quantity,
      data_ultima_compra: hasPurchase ? movementDate : null,
      operacao_ultima_compra: hasPurchase ? 'COMPRA' : null,
      data_ultima_transferencia: hasTransfer ? movementDate : null,
      operacao_ultima_transferencia: hasTransfer ? 'TRANSFERENCIA' : null,
      data_ultima_venda: hasSale ? movementDate : null,
      cod_cliente_ultima_venda: '',
      cliente_ultima_venda: '',
      quantidade_compra_produto: Number(row.entrada_compra) || 0,
      valor_estoque: stockValue,
      custo: estimatedCost,
      custo_fornecedor: estimatedCost,
      custo_medio: estimatedCost,
      custo_ultima_compra: estimatedCost,
      tipo_relatorio: 'GIRO API - CONTINGENCIA',
    };
  });
}

export function useEstoqueData() {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa } = useEmpresaAtiva();

  const consolidadoQuery = useQuery({
    queryKey: ['estoque-consolidado', codEmpresaAtiva],
    queryFn: async () => fetchEstoqueSource(empresa!, 'consolidado'),
    enabled: !!empresa && !!empresa.modulo_operacional,
    staleTime: 5 * 60 * 1000,
  });

  const detalhadoQuery = useQuery({
    queryKey: ['estoque-detalhado', codEmpresaAtiva],
    queryFn: async () => fetchEstoqueSource(empresa!, 'detalhado'),
    enabled: !!empresa && !!empresa.modulo_operacional,
    staleTime: 5 * 60 * 1000,
  });

  const giroQuery = useQuery({
    queryKey: ['estoque-giro', codEmpresaAtiva],
    queryFn: async () => fetchEstoqueSource(empresa!, 'giro'),
    enabled: !!empresa && !!empresa.modulo_operacional,
    staleTime: 5 * 60 * 1000,
  });

  const estoqueConsolidadoPrincipal = filtrarEstoqueCasaChevrolet10041(
    (consolidadoQuery.data || []) as unknown as Array<Record<string, unknown>>,
    codEmpresaAtiva,
  ) as unknown as EstoqueRecord[];
  const estoqueDetalhadoPrincipal = filtrarEstoqueCasaChevrolet10041(
    (detalhadoQuery.data || []) as unknown as Array<Record<string, unknown>>,
    codEmpresaAtiva,
  ) as unknown as EstoqueRecord[];
  const giroData = filtrarEstoqueCasaChevrolet10041(
    (giroQuery.data || []) as unknown as Array<Record<string, unknown>>,
    codEmpresaAtiva,
  ) as unknown as GiroRecord[];
  const estoqueFallback = buildEstoqueFallbackFromGiro(giroData, codEmpresaAtiva);
  const consolidadoData = estoqueConsolidadoPrincipal.length > 0
    ? estoqueConsolidadoPrincipal
    : estoqueFallback;
  const detalhadoData = estoqueDetalhadoPrincipal.length > 0
    ? estoqueDetalhadoPrincipal
    : estoqueFallback;

  const isLoading = isLoadingEmpresa || consolidadoQuery.isLoading || detalhadoQuery.isLoading || giroQuery.isLoading;
  const isError = consolidadoQuery.isError || detalhadoQuery.isError || giroQuery.isError;

  return {
    consolidadoData,
    detalhadoData,
    giroData,
    isLoading,
    isError,
    empresa,
    isMasterDemo: false,
  };
}

