import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useToast } from '@/hooks/use-toast';

export interface MemberInstanceInfo {
  id: string;
  name: string;
  instance_name: string;
  api_url: string;
  status: string | null;
  qr_code: string | null;
  phone_e164: string | null;
}

/**
 * Busca a instância vinculada a um membro pelo phone_e164.
 * Cada vendedor (membro) tem sua própria instância da Evolution.
 */
export function useMemberInstanceByPhone(phoneE164: string | null) {
  const { empresa } = useEmpresaAtiva();
  return useQuery({
    queryKey: ['member-instance', empresa?.id, phoneE164],
    enabled: !!empresa?.id && !!phoneE164,
    refetchInterval: 8000,
    queryFn: async (): Promise<MemberInstanceInfo | null> => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, name, instance_name, api_url, status, qr_code, phone_e164')
        .eq('company_id', empresa!.id)
        .eq('phone_e164', phoneE164!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

/**
 * Cria uma instância nova já marcando o phone_e164 do membro,
 * para que ela seja reconhecida como "do vendedor X".
 */
export function useCreateInstanceForMember() {
  const qc = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      phone_e164: string;
      display_name?: string;
      name: string;
      instance_name: string;
      api_url: string;
      api_key: string;
    }) => {
      if (!empresa?.id) throw new Error('Empresa não selecionada');

      const { data: instance, error: insErr } = await supabase
        .from('whatsapp_instances')
        .insert({
          company_id: empresa.id,
          name: payload.name,
          instance_name: payload.instance_name,
          api_url: payload.api_url.replace(/\/$/, ''),
          phone_e164: payload.phone_e164,
          status: 'disconnected',
        })
        .select('id')
        .single();
      if (insErr || !instance) throw insErr || new Error('Falha ao criar instância');

      const { error: secErr } = await supabase
        .from('whatsapp_instance_secrets')
        .insert({ instance_id: instance.id, api_key: payload.api_key });
      if (secErr) {
        await supabase.from('whatsapp_instances').delete().eq('id', instance.id);
        throw secErr;
      }

      return instance.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-instance'] });
      qc.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast({ title: 'Instância criada', description: 'Agora gere o QR Code para conectar.' });
    },
    onError: (e: any) =>
      toast({ title: 'Erro ao criar instância', description: e.message, variant: 'destructive' }),
  });
}
