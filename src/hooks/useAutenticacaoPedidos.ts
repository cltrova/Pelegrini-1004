import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useAuth } from '@/contexts/AuthContext';

export interface ImportacaoRow {
  id: string;
  cod_empresa_bi: string;
  cod_filial: string | null;
  usuario_id: string;
  arquivo_nome: string;
  arquivo_tamanho: number | null;
  data_ini: string | null;
  data_fim: string | null;
  total_linhas: number;
  total_autenticados: number;
  total_divergentes: number;
  total_nao_encontrados: number;
  total_extras: number;
  status: string;
  created_at: string;
}

export function useHistoricoAutenticacao() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['autenticacao-historico', codEmpresaAtiva, user?.id],
    enabled: !!user && !!codEmpresaAtiva,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autenticacao_importacoes')
        .select('*')
        .eq('cod_empresa_bi', codEmpresaAtiva!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ImportacaoRow[];
    },
  });
}

export interface ResultadoRow {
  id: string;
  importacao_id: string;
  numero_pedido: string;
  cliente_planilha: string | null;
  cliente_sistema: string | null;
  valor_planilha: number | null;
  valor_sistema: number | null;
  status: string;
  divergencias: string[] | null;
}

export async function carregarResultados(importacaoId: string): Promise<ResultadoRow[]> {
  const { data, error } = await supabase
    .from('autenticacao_resultados')
    .select('*')
    .eq('importacao_id', importacaoId)
    .order('status', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ResultadoRow[];
}
