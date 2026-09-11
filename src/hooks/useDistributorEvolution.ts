import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { normalizeDistributorRows, type DistributorBrand } from '@/components/operacional/estoque/distributorEvolutionData';

export interface DistributorEvolutionFilters {
  dataInicio: string;
  dataFim: string;
  marcas: DistributorBrand[];
  considerarPedidosAbertos: boolean;
  considerarTransferenciaCompra: boolean;
  imputarTransferenciaVenda: boolean;
  operacaoFiscalInicial: number;
  operacaoFiscalFinal: number;
}

export function buildDistributorEvolutionPath(filters: DistributorEvolutionFilters): string {
  const params = new URLSearchParams({
    cod_empresa_bi: '1004',
    data_ini: filters.dataInicio,
    data_fim: filters.dataFim,
    marcas: filters.marcas.join(','),
    custo: 'fornecedor',
    operacao_fiscal_ini: String(filters.operacaoFiscalInicial),
    operacao_fiscal_fim: String(filters.operacaoFiscalFinal),
    considerar_pedidos_abertos: String(filters.considerarPedidosAbertos),
    considerar_transferencia_compra: String(filters.considerarTransferenciaCompra),
    imputar_transferencia_venda: String(filters.imputarTransferenciaVenda),
  });
  return `/operacional/estoque/evolucao-distribuidores?${params.toString()}`;
}

async function fetchDistributorEvolution(path: string, empresa: NonNullable<ReturnType<typeof useEmpresaAtiva>['empresa']>) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(buildApiProxyUrl(empresa, path), {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'O endpoint de evolução de distribuidores ainda não está disponível na API.'
      : `Não foi possível consultar a evolução dos distribuidores (HTTP ${response.status}).`);
  }
  if (response.headers.get('x-proxy-upstream-error') === 'true') {
    throw new Error('A API não conseguiu gerar o relatório de distribuidores.');
  }
  return normalizeDistributorRows(await response.json());
}

export function useDistributorEvolution(filters: DistributorEvolutionFilters, enabled: boolean) {
  const { empresa } = useEmpresaAtiva();
  const path = buildDistributorEvolutionPath(filters);
  return useQuery({
    queryKey: ['estoque-evolucao-distribuidores', path],
    queryFn: () => fetchDistributorEvolution(path, empresa!),
    enabled: enabled && Boolean(empresa),
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
}
