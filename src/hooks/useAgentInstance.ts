import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useToast } from '@/hooks/use-toast';

export interface WhatsappInstance {
  id: string;
  company_id: string;
  name: string;
  instance_name: string;
  api_url: string;
  status: string | null;
  qr_code: string | null;
  phone_number: string | null;
  phone_e164: string | null;
}

// List instances of the active company that are NOT linked to any other agent
export function useAvailableInstances(currentAgentId?: string | null) {
  const { empresa } = useEmpresaAtiva();
  return useQuery({
    queryKey: ['agent-available-instances', empresa?.id, currentAgentId],
    enabled: !!empresa?.id,
    queryFn: async (): Promise<WhatsappInstance[]> => {
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('id, company_id, name, instance_name, api_url, status, qr_code, phone_number, phone_e164')
        .eq('company_id', empresa!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: linkedAgents } = await supabase
        .from('whatsapp_agents')
        .select('instance_id, id')
        .eq('company_id', empresa!.id)
        .not('instance_id', 'is', null);

      const linkedIds = new Set(
        (linkedAgents || [])
          .filter((a: any) => a.id !== currentAgentId)
          .map((a: any) => a.instance_id)
      );
      return (instances || []).filter((i: any) => !linkedIds.has(i.id)) as any;
    },
  });
}

export function useInstanceById(instanceId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-instance', instanceId],
    enabled: !!instanceId,
    queryFn: async (): Promise<WhatsappInstance | null> => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, company_id, name, instance_name, api_url, status, qr_code, phone_number, phone_e164')
        .eq('id', instanceId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 10000,
  });
}

export function useCreateInstanceForAgent() {
  const qc = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      agent_id: string;
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

      const { error: agErr } = await supabase
        .from('whatsapp_agents')
        .update({ instance_id: instance.id })
        .eq('id', payload.agent_id);
      if (agErr) {
        await supabase.from('whatsapp_instance_secrets').delete().eq('instance_id', instance.id);
        await supabase.from('whatsapp_instances').delete().eq('id', instance.id);
        throw agErr;
      }

      return instance.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agents'] });
      qc.invalidateQueries({ queryKey: ['agent-available-instances'] });
      toast({ title: 'Instância criada e vinculada ao agente' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

export function useLinkInstanceToAgent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: { agent_id: string; instance_id: string }) => {
      const { error } = await supabase
        .from('whatsapp_agents')
        .update({ instance_id: payload.instance_id })
        .eq('id', payload.agent_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agents'] });
      qc.invalidateQueries({ queryKey: ['agent-available-instances'] });
      toast({ title: 'Instância vinculada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

export function useUnlinkInstanceFromAgent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from('whatsapp_agents')
        .update({ instance_id: null, phone_e164: null })
        .eq('id', agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agents'] });
      qc.invalidateQueries({ queryKey: ['agent-available-instances'] });
      toast({ title: 'Instância desvinculada do agente' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

export function useInstanceAction() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      instanceId: string;
      action: 'status' | 'qrcode' | 'disconnect' | 'restart';
    }) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: payload,
      });
      if (error) throw error;
      return data as {
        success?: boolean;
        status?: string;
        qrCode?: string | null;
        state?: string;
        phone_e164?: string | null;
        data?: any;
        error?: string;
        details?: any;
      };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-instance', vars.instanceId] });
    },
    onError: (e: any) => toast({ title: 'Erro Evolution API', description: e.message, variant: 'destructive' }),
  });
}

// Sync instance phone to agent when connected
export async function syncAgentPhoneFromInstance(agentId: string, instanceId: string) {
  const { data: inst } = await supabase
    .from('whatsapp_instances')
    .select('phone_e164, status')
    .eq('id', instanceId)
    .maybeSingle();
  if (inst?.phone_e164 && inst.status === 'connected') {
    await supabase
      .from('whatsapp_agents')
      .update({ phone_e164: inst.phone_e164 })
      .eq('id', agentId);
  }
}
