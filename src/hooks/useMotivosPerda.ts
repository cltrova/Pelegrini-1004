import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isLocalPreviewEnabled,
  readLocalPreviewMotivosPerda,
  saveLocalPreviewMotivoPerda,
} from '@/config/localPreview';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export const MOTIVOS_PERDA = [
  'preco',
  'prazo_entrega',
  'condicao_pagamento',
  'concorrencia',
  'indisponibilidade_produto',
  'cliente_desistiu',
  'cotacao_vencida',
  'outro',
] as const;

export type MotivoPerda = (typeof MOTIVOS_PERDA)[number];

export interface MotivoPerdaInput {
  motivo: MotivoPerda;
  observacao?: string | null;
}

export interface SalvarMotivoPerdaInput extends MotivoPerdaInput {
  idCotacao: string;
}

export type MotivoPerdaRegistro = Database['public']['Tables']['comercial_motivos_perda']['Row'];

export function validarMotivoPerda(input: MotivoPerdaInput | SalvarMotivoPerdaInput) {
  if ('idCotacao' in input && !String(input.idCotacao ?? '').trim()) {
    return { valido: false as const, erro: 'Informe a cotação.' };
  }

  if (input.motivo === 'outro' && !String(input.observacao ?? '').trim()) {
    return { valido: false as const, erro: 'Informe a observação para o motivo Outro.' };
  }

  return { valido: true as const };
}

export function buildMotivoPerdaUpsert(
  idCotacao: string,
  input: MotivoPerdaInput,
  createdBy: string,
) {
  const idCotacaoNormalizado = String(idCotacao).trim();
  const validacao = validarMotivoPerda({ ...input, idCotacao: idCotacaoNormalizado });
  if (!validacao.valido) throw new Error(validacao.erro);

  const observacao = String(input.observacao ?? '').trim() || null;

  return {
    cod_empresa_bi: '10041',
    id_cotacao: idCotacaoNormalizado,
    motivo: input.motivo,
    observacao,
    created_by: createdBy,
  };
}

export function useMotivosPerda10041(idsCotacao: string[]) {
  const { user } = useAuth();
  const localPreview = isLocalPreviewEnabled();
  const ids = useMemo(
    () => Array.from(new Set(idsCotacao.map((id) => String(id).trim()).filter(Boolean))),
    [idsCotacao],
  );

  return useQuery({
    queryKey: ['comercial-motivos-perda', '10041', ids],
    queryFn: async () => {
      if (localPreview) {
        return readLocalPreviewMotivosPerda()
          .filter((registro) => ids.includes(registro.id_cotacao)) as MotivoPerdaRegistro[];
      }

      const { data, error } = await supabase
        .from('comercial_motivos_perda')
        .select('*')
        .eq('cod_empresa_bi', '10041')
        .in('id_cotacao', ids);

      if (error) throw error;
      return (data ?? []) as MotivoPerdaRegistro[];
    },
    enabled: (localPreview || !!user) && ids.length > 0,
  });
}

export function useSalvarMotivoPerda10041() {
  const { user } = useAuth();
  const localPreview = isLocalPreviewEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ idCotacao, ...input }: SalvarMotivoPerdaInput) => {
      if (!user) throw new Error('Usuário não autenticado.');

      const validacao = validarMotivoPerda({ ...input, idCotacao });
      if (!validacao.valido) throw new Error(validacao.erro);

      if (localPreview) {
        return saveLocalPreviewMotivoPerda(
          buildMotivoPerdaUpsert(idCotacao, input, user.id),
        ) as MotivoPerdaRegistro;
      }

      const { data, error } = await supabase
        .from('comercial_motivos_perda')
        .upsert(buildMotivoPerdaUpsert(idCotacao, input, user.id), {
          onConflict: 'cod_empresa_bi,id_cotacao',
        })
        .select()
        .single();

      if (error) throw error;
      return data as MotivoPerdaRegistro;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comercial-motivos-perda', '10041'] }),
  });
}
