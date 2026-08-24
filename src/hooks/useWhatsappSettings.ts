import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

// ============= TEAM MEMBERS =============
export function useTeamMembers() {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;
  
  return useQuery({
    queryKey: ['whatsapp-team-members', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ nome, email }: { nome: string; email: string }) => {
      // For now, just create a profile entry - in production would send email
      const { error } = await supabase
        .from('profiles')
        .insert({ 
          user_id: crypto.randomUUID(), // Placeholder
          email, 
          nome,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-team-members'] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      // Store role in user_roles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', id)
        .single();
      
      if (!profile) throw new Error('Profile not found');
      
      // Update would go to user_roles table
      // For now, just return success
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-team-members'] });
    },
  });
}

export function useToggleMemberActive() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // Would update is_active field if it existed
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-team-members'] });
    },
  });
}

export function useToggleMemberApproval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_approved }: { id: string; is_approved: boolean }) => {
      // Would update is_approved field if it existed
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-team-members'] });
    },
  });
}

// ============= ASSIGNMENT RULES =============
export function useAssignmentRules() {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;
  
  return useQuery({
    queryKey: ['whatsapp-assignment-rules', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      const { data, error } = await supabase
        .from('assignment_rules')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });
}

export function useCreateAssignmentRule() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;
  
  return useMutation({
    mutationFn: async (data: any) => {
      if (!empresaId) throw new Error('No company selected');
      
      const { error } = await supabase
        .from('assignment_rules')
        .insert({
          company_id: empresaId,
          rule_type: data.rule_type,
          instance_id: data.instance_id || null,
          fixed_agent_id: data.fixed_agent_id || null,
          participating_agents: data.participating_agents || [],
          is_active: data.is_active ?? true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-assignment-rules'] });
    },
  });
}

export function useUpdateAssignmentRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from('assignment_rules')
        .update({
          rule_type: data.rule_type,
          instance_id: data.instance_id || null,
          fixed_agent_id: data.fixed_agent_id || null,
          participating_agents: data.participating_agents || [],
          is_active: data.is_active,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-assignment-rules'] });
    },
  });
}

export function useDeleteAssignmentRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('assignment_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-assignment-rules'] });
    },
  });
}

// ============= EMPRESAS (for WhatsApp) =============
export function useWhatsappEmpresas() {
  return useQuery({
    queryKey: ['whatsapp-empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('modulo_whatsapp', true)
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateEmpresa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('empresas')
        .insert({
          nome: data.nome,
          cod_empresa_bi: data.nome.toUpperCase().replace(/\s+/g, '_'),
          endpoint_url: '',
          modulo_whatsapp: true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-empresas'] });
    },
  });
}

export function useUpdateEmpresa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from('empresas')
        .update({ nome: data.nome })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-empresas'] });
    },
  });
}

export function useDeleteEmpresa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-empresas'] });
    },
  });
}

// ============= INSTANCES =============
export function useCreateInstance() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;
  
  return useMutation({
    mutationFn: async (data: any) => {
      if (!empresaId) throw new Error('No company selected');
      
      // Create instance
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .insert({
          company_id: empresaId,
          name: data.name,
          instance_name: data.instance_name,
          api_url: data.api_url,
          status: 'disconnected',
        })
        .select()
        .single();
      
      if (instanceError) throw instanceError;
      
      // Store API key in secrets table
      if (data.api_key && instance) {
        const { error: secretError } = await supabase
          .from('whatsapp_instance_secrets')
          .insert({
            instance_id: instance.id,
            api_key: data.api_key,
          });
        
        if (secretError) throw secretError;
      }
      
      return instance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useUpdateInstance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({
          name: data.name,
          instance_name: data.instance_name,
          api_url: data.api_url,
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Update API key if provided
      if (data.api_key) {
        await supabase
          .from('whatsapp_instance_secrets')
          .upsert({
            instance_id: id,
            api_key: data.api_key,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete secrets first
      await supabase
        .from('whatsapp_instance_secrets')
        .delete()
        .eq('instance_id', id);
      
      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useTestInstance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { instanceId: id, action: 'status' },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useConnectInstance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { instanceId: id, action: 'qrcode' },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useDisconnectInstance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { instanceId: id, action: 'disconnect' },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useRestartInstance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { instanceId: id, action: 'restart' },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

// ============= MACROS =============
export function useCreateMacro() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;
  
  return useMutation({
    mutationFn: async (data: any) => {
      if (!empresaId) throw new Error('No company selected');
      
      const { error } = await supabase
        .from('whatsapp_macros')
        .insert({
          company_id: empresaId,
          name: data.name,
          shortcut: data.shortcut,
          content: data.content,
          category: data.category || null,
          is_active: data.is_active ?? true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-macros'] });
    },
  });
}

export function useUpdateMacro() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from('whatsapp_macros')
        .update({
          name: data.name,
          shortcut: data.shortcut,
          content: data.content,
          category: data.category || null,
          is_active: data.is_active,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-macros'] });
    },
  });
}

export function useDeleteMacro() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_macros')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-macros'] });
    },
  });
}

// ============= SECURITY SETTINGS =============
export function useSecuritySettings() {
  return useQuery({
    queryKey: ['whatsapp-security-settings'],
    queryFn: async () => {
      // Would fetch from project_config table if it existed
      // Return defaults for now
      return {
        restrict_signup_by_domain: false,
        allowed_domains: '',
        require_approval: false,
      };
    },
  });
}

export function useUpdateSecuritySettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      // Would update project_config table
      // For now, just return success
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-security-settings'] });
    },
  });
}
