import { useQuery } from '@tanstack/react-query';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { supabase } from '@/integrations/supabase/client';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { EstoqueRecord, GiroRecord } from '@/types/estoque';
import { filtrarEstoqueCasaChevrolet10041 } from '@/utils/estoque10041';

async function fetchFromStorage(storagePath: string): Promise<any[]> {
  console.log(`[Estoque] Buscando do storage: ${storagePath}`);
  const { data, error } = await supabase.storage
    .from('dados-json')
    .download(storagePath);
  if (error) {
    console.error('[Estoque] Erro ao baixar do storage:', error);
    throw error;
  }
  const text = await data.text();
  return JSON.parse(text);
}

async function fetchFromEndpoint(
  empresa: any,
  endpointPath: string
): Promise<any[]> {
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
    return await response.json();
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
  empresa: any,
  type: 'giro' | 'consolidado' | 'detalhado'
): Promise<any[]> {
  const jsonKey = `json_path_estoque_${type}` as keyof typeof empresa;
  const endpointKey = `endpoint_path_estoque_${type}` as keyof typeof empresa;

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

  const consolidadoData = filtrarEstoqueCasaChevrolet10041(
    (consolidadoQuery.data || []) as unknown as Array<Record<string, unknown>>,
    codEmpresaAtiva,
  ) as unknown as EstoqueRecord[];
  const detalhadoData = filtrarEstoqueCasaChevrolet10041(
    (detalhadoQuery.data || []) as unknown as Array<Record<string, unknown>>,
    codEmpresaAtiva,
  ) as unknown as EstoqueRecord[];
  const giroData = filtrarEstoqueCasaChevrolet10041(
    (giroQuery.data || []) as unknown as Array<Record<string, unknown>>,
    codEmpresaAtiva,
  ) as unknown as GiroRecord[];

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

