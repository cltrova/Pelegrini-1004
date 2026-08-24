import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useToast } from '@/hooks/use-toast';

export interface WhatsappAgent {
  id: string;
  company_id: string;
  instance_id: string | null;
  name: string;
  description: string | null;
  avatar_url: string | null;
  phone_e164: string | null;
  persona_prompt: string;
  tone: string;
  rules: any[];
  supervises_clients: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsappAgentGroup {
  id: string;
  agent_id: string;
  company_id: string;
  name: string;
  description: string | null;
  default_for_topics: string[];
  is_active: boolean;
  created_at: string;
}

export interface WhatsappAgentGroupMember {
  id: string;
  group_id: string;
  company_id: string;
  phone_e164: string;
  display_name: string | null;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
}

// LIST AGENTS
export function useWhatsappAgents() {
  const { empresa } = useEmpresaAtiva();
  return useQuery({
    queryKey: ['whatsapp-agents', empresa?.id],
    enabled: !!empresa?.id,
    queryFn: async (): Promise<WhatsappAgent[]> => {
      const { data, error } = await supabase
        .from('whatsapp_agents')
        .select('*')
        .eq('company_id', empresa!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

export function useUpsertAgent() {
  const qc = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: Partial<WhatsappAgent> & { id?: string }) => {
      if (!empresa?.id) throw new Error('Empresa não selecionada');
      const base = { ...payload, company_id: empresa.id };
      if (payload.id) {
        const { data, error } = await supabase
          .from('whatsapp_agents')
          .update(base)
          .eq('id', payload.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('whatsapp_agents')
          .insert({
            company_id: empresa.id,
            name: payload.name || 'Novo Agente',
            description: payload.description ?? null,
            instance_id: payload.instance_id ?? null,
            phone_e164: payload.phone_e164 ?? null,
            persona_prompt: payload.persona_prompt ?? '',
            tone: payload.tone ?? 'neutro',
            rules: (payload.rules ?? []) as any,
            supervises_clients: payload.supervises_clients ?? false,
            is_active: payload.is_active ?? true,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agents'] });
      toast({ title: 'Agente salvo com sucesso' });
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_agents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agents'] });
      toast({ title: 'Agente removido' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

// GROUPS
export function useAgentGroups(agentId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-agent-groups', agentId],
    enabled: !!agentId,
    queryFn: async (): Promise<WhatsappAgentGroup[]> => {
      const { data, error } = await supabase
        .from('whatsapp_agent_groups')
        .select('*')
        .eq('agent_id', agentId!)
        .order('name');
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

export function useUpsertAgentGroup() {
  const qc = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: Partial<WhatsappAgentGroup> & { agent_id: string; id?: string }) => {
      if (!empresa?.id) throw new Error('Empresa não selecionada');
      if (payload.id) {
        const { data, error } = await supabase
          .from('whatsapp_agent_groups')
          .update(payload)
          .eq('id', payload.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('whatsapp_agent_groups')
        .insert({
          agent_id: payload.agent_id,
          company_id: empresa.id,
          name: payload.name || 'Novo Grupo',
          description: payload.description ?? null,
          default_for_topics: payload.default_for_topics ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agent-groups', vars.agent_id] });
      toast({ title: 'Grupo salvo' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteAgentGroup() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id }: { id: string; agent_id: string }) => {
      const { error } = await supabase.from('whatsapp_agent_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agent-groups', vars.agent_id] });
      toast({ title: 'Grupo removido' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

// MEMBERS
export function useAgentGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-agent-group-members', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<WhatsappAgentGroupMember[]> => {
      const { data, error } = await supabase
        .from('whatsapp_agent_group_members')
        .select('*')
        .eq('group_id', groupId!)
        .order('display_name', { nullsFirst: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: { group_id: string; phone_e164: string; display_name?: string }) => {
      if (!empresa?.id) throw new Error('Empresa não selecionada');
      const { data, error } = await supabase
        .from('whatsapp_agent_group_members')
        .insert({
          group_id: payload.group_id,
          company_id: empresa.id,
          phone_e164: payload.phone_e164,
          display_name: payload.display_name ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agent-group-members', vars.group_id] });
      toast({ title: 'Membro adicionado' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id }: { id: string; group_id: string }) => {
      const { error } = await supabase.from('whatsapp_agent_group_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agent-group-members', vars.group_id] });
      toast({ title: 'Membro removido' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
}

// HISTORY
export function useAgentBroadcasts(agentId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['whatsapp-agent-broadcasts', agentId, limit],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_agent_broadcasts')
        .select('*')
        .eq('agent_id', agentId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAgentInterventions(agentId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['whatsapp-agent-interventions', agentId, limit],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_agent_interventions')
        .select('*')
        .eq('agent_id', agentId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}
