import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useToast } from '@/hooks/use-toast';

export interface CobrancaIntervencao {
  id: string;
  cod_empresa_bi: string;
  conversation_id: string | null;
  contact_phone: string | null;
  cliente_nome: string | null;
  cod_cliente: string | null;
  pedido_numero: string | null;
  duplicata_id: string | null;
  valor: number | null;
  data_vencimento: string | null;
  tipo: string;
  prioridade: 'baixa' | 'normal' | 'alta';
  agent_summary: string;
  ultima_mensagem_cliente: string | null;
  user_response: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  status: 'pendente' | 'respondido' | 'resolvido' | 'cancelado';
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useCobrancaIntervencoes() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['cobranca-intervencoes', codEmpresaAtiva],
    enabled: !!codEmpresaAtiva,
    queryFn: async (): Promise<CobrancaIntervencao[]> => {
      const { data, error } = await supabase
        .from('cobranca_intervencoes')
        .select('*')
        .eq('cod_empresa_bi', codEmpresaAtiva!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as CobrancaIntervencao[];
    },
  });

  // realtime
  useEffect(() => {
    if (!codEmpresaAtiva) return;
    const channel = supabase
      .channel(`cobranca-interv-${codEmpresaAtiva}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cobranca_intervencoes',
        filter: `cod_empresa_bi=eq.${codEmpresaAtiva}`,
      }, (payload) => {
        qc.invalidateQueries({ queryKey: ['cobranca-intervencoes', codEmpresaAtiva] });
        if (payload.eventType === 'INSERT') {
          const item = payload.new as CobrancaIntervencao;
          toast({
            title: '🔔 Nova solicitação do agente',
            description: `${item.cliente_nome || 'Cliente'} — ${item.agent_summary || item.tipo}`,
          });
          // beep
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880; g.gain.value = 0.06;
            o.start(); o.stop(ctx.currentTime + 0.18);
            setTimeout(() => ctx.close(), 300);
          } catch { /* ignore */ }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [codEmpresaAtiva, qc, toast]);

  const respond = useMutation({
    mutationFn: async (input: {
      intervencao_id: string;
      message?: string;
      attachment_url?: string;
      attachment_type?: string;
      mark_resolved?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('cobranca-respond', { body: input });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranca-intervencoes', codEmpresaAtiva] });
      toast({ title: 'Resposta enviada ao cliente' });
    },
    onError: (e: any) => toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' }),
  });

  const uploadAttachment = async (file: File): Promise<{ url: string; type: string }> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${codEmpresaAtiva}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('cobranca-anexos').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('cobranca-anexos').getPublicUrl(path);
    return { url: data.publicUrl, type: file.type };
  };

  return {
    intervencoes: query.data ?? [],
    pendentes: (query.data ?? []).filter(i => i.status === 'pendente'),
    isLoading: query.isLoading,
    respond,
    uploadAttachment,
  };
}
