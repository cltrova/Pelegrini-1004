import { useQuery } from '@tanstack/react-query';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import { supabase } from '@/integrations/supabase/client';
import { isLocalPreviewEnabled } from '@/config/localPreview';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { parseEstoqueAtual } from '@/utils/estoqueAtual';

export async function fetchEstoqueAtual(empresa: Empresa, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token && !isLocalPreviewEnabled()) throw new Error('Entre novamente no sistema para consultar o estoque.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 100000);
  try {
    const response = await fetch(buildApiProxyUrl(empresa, '/operacional/estoque/atual?cod_empresa_bi=1004'), {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    if (!response.ok || response.headers.get('x-proxy-upstream-error') === 'true') {
      throw new Error('Não foi possível consultar o estoque atual. Tente atualizar novamente.');
    }
    return parseEstoqueAtual(await response.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error('A consulta de estoque foi interrompida ou excedeu o tempo de resposta.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

export function useEstoqueAtual(empresa: Empresa | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['estoque-atual', '1004', empresa?.id, empresa?.endpoint_url, empresa?.vps_base_url, empresa?.vps_cliente_identificador, empresa?.usar_vps_intermediaria],
    queryFn: ({ signal }) => fetchEstoqueAtual(empresa!, signal),
    enabled: enabled && Boolean(empresa?.modulo_operacional),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}
