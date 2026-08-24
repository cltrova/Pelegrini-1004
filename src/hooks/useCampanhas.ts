import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CampanhaMarca {
  marca: string;
  meta_mensal: number;
  percentual_premio: number; // ex: 0.5 = 0,5%
  premio_fixo?: number; // alternativa ao percentual
}

export interface Campanha {
  id: string;
  cod_empresa_bi: string;
  nome: string;
  marca: string | null; // legado (compat)
  marcas: CampanhaMarca[];
  data_inicio: string;
  data_fim: string;
  meta_valor: number; // legado (compat)
  meta_geral_mensal: number;
  bonus_meta_geral: number;
  premiacao: string | null;
  descricao: string | null;
  mensagem_equipe: string | null;
  observacoes: string | null;
  status: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export type CampanhaInput = Omit<Campanha, 'id' | 'created_at' | 'updated_at' | 'criado_por' | 'cod_empresa_bi'>;

export function useCampanhas() {
  const { empresa, codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const { user } = useAuth();
  const qc = useQueryClient();
  const codEmpresaCampanhas = resolveCodEmpresaBiParam(empresa, filialAtiva) || codEmpresaAtiva;

  const query = useQuery({
    queryKey: ['campanhas', codEmpresaCampanhas],
    enabled: !!user && !!codEmpresaCampanhas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campanhas')
        .select('*')
        .eq('cod_empresa_bi', codEmpresaCampanhas!)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map(d => ({
        ...d,
        marcas: Array.isArray(d.marcas) ? d.marcas : [],
      })) as Campanha[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: CampanhaInput) => {
      const { data, error } = await supabase
        .from('campanhas')
        .insert({ ...input, cod_empresa_bi: codEmpresaCampanhas!, criado_por: user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha criada com sucesso');
    },
    onError: (e: any) => toast.error(`Erro ao criar: ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CampanhaInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('campanhas')
        .update(input as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha atualizada');
    },
    onError: (e: any) => toast.error(`Erro ao atualizar: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campanhas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha excluída');
    },
    onError: (e: any) => toast.error(`Erro ao excluir: ${e.message}`),
  });

  return {
    campanhas: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMut.mutateAsync,
    update: updateMut.mutateAsync,
    remove: deleteMut.mutateAsync,
    isMutating: createMut.isPending || updateMut.isPending || deleteMut.isPending,
  };
}
