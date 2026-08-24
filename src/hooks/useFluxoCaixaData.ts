import { useQuery } from '@tanstack/react-query';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';

export interface FluxoSaldoRecord {
  CodEmpresa_bi: number | string;
  CodEmpresa: number | string;
  CodBanco: number | string;
  Banco: string;
  SaldoInterno: number | null;
  SaldoConciliado: number | null;
  Fonte: string | null;
}

export interface FluxoMovimentoRecord {
  CodEmpresa_bi: number | string;
  CodEmpresa: number | string;
  DataVencimento: string | null;
  CodBanco: number | string;
  MesVencimento: number | null;
  SemanaVencimento: number | null;
  MovCaixaReceber: number | null;
  MovCaixaPagar: number | null;
  'Duplicatas.Dupl Receber'?: number | null;
}

async function fetchJson<T>(empresa: any, jsonPath: string | null, endpointPath: string | null, label: string): Promise<T[]> {
  if (jsonPath) {
    const clean = jsonPath.replace(/^storage:/, '').replace(/^\/+/, '');
    console.log(`[Fluxo de Caixa] fetch storage ${label}:`, clean);
    const { data, error } = await supabase.storage.from('dados-json').download(clean);
    if (error) throw new Error(`Falha ao baixar JSON: ${error.message}`);
    const text = await data.text();
    const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const parsed = JSON.parse(sanitized);
    if (!Array.isArray(parsed)) throw new Error('JSON precisa ser um array');
    console.log(`[Fluxo de Caixa] registros ${label}:`, parsed.length);
    return parsed as T[];
  }
  if (endpointPath) {
    const path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const url = buildApiProxyUrl(empresa, path);
    console.log(`[Fluxo de Caixa] fetch endpoint ${label}:`, {
      empresaFonte: empresa?.cod_empresa_bi,
      path,
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
      console.log(`[Fluxo de Caixa] status HTTP ${label}:`, res.status);
      if (!res.ok) throw new Error(`Erro ao carregar ${label} (${res.status} ${res.statusText}) em ${path}`);
      const text = await res.text();
      const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
      const parsed = JSON.parse(sanitized);
      if (!Array.isArray(parsed)) throw new Error('Resposta precisa ser um array');
      console.log(`[Fluxo de Caixa] registros ${label}:`, parsed.length);
      return parsed as T[];
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Nenhuma fonte de dados configurada para ${label}`);
}

export function useFluxoCaixaData() {
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();
  const { hasSearched } = useFinanceiroSearch();

  return useQuery({
    queryKey: ['fluxo-caixa', codEmpresaAtiva],
    enabled: !!empresa,
    queryFn: async () => {
      if (!empresa) return { saldos: [] as FluxoSaldoRecord[], movimentos: [] as FluxoMovimentoRecord[], saldosError: null, movimentosError: null };

      const jsonSaldos = (empresa as any).json_path_fluxo_caixa as string | null;
      const epSaldos = (empresa as any).endpoint_path_fluxo_caixa as string | null;
      const jsonMov = (empresa as any).json_path_fluxo_caixa_movimento as string | null;
      const epMov = (empresa as any).endpoint_path_fluxo_caixa_movimento as string | null;

      const [saldosRes, movRes] = await Promise.allSettled([
        fetchJson<FluxoSaldoRecord>(empresa, jsonSaldos, epSaldos, 'saldos'),
        fetchJson<FluxoMovimentoRecord>(empresa, jsonMov, epMov, 'movimentos'),
      ]);

      if (saldosRes.status === 'rejected' || movRes.status === 'rejected') {
        const errors = [
          saldosRes.status === 'rejected' ? `Saldos: ${String(saldosRes.reason)}` : null,
          movRes.status === 'rejected' ? `Movimentos: ${String(movRes.reason)}` : null,
        ].filter(Boolean).join(' | ');
        throw new Error(`Falha ao carregar Fluxo de Caixa da empresa ${codEmpresaAtiva}: ${errors}`);
      }

      const result = {
        saldos: saldosRes.value,
        movimentos: movRes.value,
        saldosError: null,
        movimentosError: null,
      };

      console.log('[Fluxo de Caixa] registros entregues à interface:', {
        saldos: result.saldos.length,
        movimentos: result.movimentos.length,
      });

      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}
