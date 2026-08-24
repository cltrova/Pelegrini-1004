import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { ESTRUTURA_DFC } from '@/hooks/useVariacaoData';
import { toast } from 'sonner';

export type DfcModo = 'grupo' | 'grupo_mais_contas' | 'contas';

export interface DfcLineConfigRow {
  id?: string;
  cod_empresa_bi: string;
  linha_id: string;
  descricao: string;
  secao: string;
  ordem: number;
  fonte: 'banco' | 'contas';
  modo: DfcModo;
  grupo: string | null;
  contas: string[];
  invert_sinal: boolean;
}

// Inferir seção a partir da estrutura padrão
function inferirSecao(ordem: number): string {
  if (ordem <= 28) return 'Operacional';
  if (ordem <= 34) return 'Investimento';
  if (ordem <= 42) return 'Financiamento';
  return 'Totais';
}

// Construir defaults a partir da ESTRUTURA_DFC
export function buildDefaultLineConfig(codEmpresaBi: string): DfcLineConfigRow[] {
  return ESTRUTURA_DFC
    .filter(item => item.tipo === 'item' && ((item as any).grupo || item.id === 'resultado_liquido'))
    .map(item => ({
      cod_empresa_bi: codEmpresaBi,
      linha_id: item.id,
      descricao: item.descricao,
      secao: inferirSecao(item.ordem),
      ordem: item.ordem,
      fonte: 'banco' as const,
      modo: 'grupo' as DfcModo,
      grupo: (item as any).grupo ?? null,
      contas: [],
      invert_sinal: false,
    }));
}

export function useDfcLineConfig() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dfc-line-config', codEmpresaAtiva],
    queryFn: async () => {
      if (!codEmpresaAtiva) return [] as DfcLineConfigRow[];
      const { data, error } = await supabase
        .from('dfc_line_config')
        .select('*')
        .eq('cod_empresa_bi', codEmpresaAtiva)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DfcLineConfigRow[];
    },
    enabled: !!codEmpresaAtiva,
    staleTime: 1000 * 60,
  });

  // Merge defaults + persisted (persisted vence)
  const merged = useMemo<DfcLineConfigRow[]>(() => {
    if (!codEmpresaAtiva) return [];
    const defaults = buildDefaultLineConfig(codEmpresaAtiva);
    const byId = new Map<string, DfcLineConfigRow>();
    defaults.forEach(d => byId.set(d.linha_id, d));
    (query.data ?? []).forEach(r => byId.set(r.linha_id, { ...byId.get(r.linha_id), ...r }));
    return Array.from(byId.values()).sort((a, b) => a.ordem - b.ordem);
  }, [query.data, codEmpresaAtiva]);

  const upsert = useMutation({
    mutationFn: async (row: DfcLineConfigRow) => {
      const { error } = await supabase
        .from('dfc_line_config')
        .upsert(
          {
            cod_empresa_bi: row.cod_empresa_bi,
            linha_id: row.linha_id,
            descricao: row.descricao,
            secao: row.secao,
            ordem: row.ordem,
            fonte: row.modo === 'contas' ? 'contas' : 'banco',
            modo: row.modo,
            grupo: row.grupo,
            contas: row.contas,
            invert_sinal: row.invert_sinal,
          },
          { onConflict: 'cod_empresa_bi,linha_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dfc-line-config', codEmpresaAtiva] });
      toast.success('Linha salva');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar', { description: err?.message });
    },
  });

  const upsertMany = useMutation({
    mutationFn: async (rows: DfcLineConfigRow[]) => {
      if (!rows.length) return;
      const payload = rows.map(r => ({
        cod_empresa_bi: r.cod_empresa_bi,
        linha_id: r.linha_id,
        descricao: r.descricao,
        secao: r.secao,
        ordem: r.ordem,
        fonte: r.modo === 'contas' ? 'contas' : 'banco',
        modo: r.modo,
        grupo: r.grupo,
        contas: r.contas,
        invert_sinal: r.invert_sinal,
      }));
      const { error } = await supabase
        .from('dfc_line_config')
        .upsert(payload, { onConflict: 'cod_empresa_bi,linha_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dfc-line-config', codEmpresaAtiva] });
      toast.success('Configuração salva');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar configuração', { description: err?.message });
    },
  });

  return {
    config: merged,
    isLoading: query.isLoading,
    upsert: upsert.mutateAsync,
    upsertMany: upsertMany.mutateAsync,
    isSaving: upsert.isPending || upsertMany.isPending,
  };
}
