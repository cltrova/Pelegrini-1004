import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetaVendedorRow {
  id: string;
  cod_empresa_bi: string;
  cod_vendedor: string;
  nome_vendedor: string | null;
  ano: number;
  mes: number;
  meta_valor: number;
}

interface Params {
  codEmpresaBi?: string | null;
  ano?: number;
  meses?: number[]; // números de mês (1..12); vazio = todos
  enabled?: boolean;
}

/**
 * Lê os cadastros de metas de vendedores no Supabase.
 * Preserva integralmente os registros existentes — este hook apenas lê.
 */
export function useMetasVendedores({ codEmpresaBi, ano, meses, enabled = true }: Params) {
  const query = useQuery({
    queryKey: ['metas_vendedores', codEmpresaBi ?? null, ano ?? null, (meses ?? []).join(',')],
    queryFn: async (): Promise<MetaVendedorRow[]> => {
      if (!codEmpresaBi) return [];
      let q = supabase
        .from('metas_vendedores')
        .select('*')
        .eq('cod_empresa_bi', String(codEmpresaBi));
      if (ano) q = q.eq('ano', ano);
      if (meses && meses.length > 0) q = q.in('mes', meses);
      const { data, error } = await q;
      if (error) {
        console.warn('[useMetasVendedores] erro:', error.message);
        return [];
      }
      return (data || []) as MetaVendedorRow[];
    },
    enabled: enabled && !!codEmpresaBi,
    staleTime: 5 * 60 * 1000,
  });

  return {
    metas: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
