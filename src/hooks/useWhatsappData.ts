import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import type { 
  WhatsappConversation, 
  WhatsappMessage, 
  WhatsappContact,
  WhatsappInstance,
  WhatsappNote,
  WhatsappMacro,
  ConversationFilters 
} from '@/types/whatsapp';

// Fetch conversations with contacts
export function useWhatsappConversations(filters?: ConversationFilters) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  
  return useQuery({
    queryKey: ['whatsapp-conversations', codEmpresaAtiva, filters],
    queryFn: async () => {
      let query = supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          contact:whatsapp_contacts(*),
          assigned_user:profiles!whatsapp_conversations_assigned_to_fkey(id, nome, email)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      
      // Apply filters
      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }
      
      if (filters?.unreadOnly) {
        query = query.gt('unread_count', 0);
      }
      
      if (filters?.inQueue) {
        query = query.eq('status', 'queue');
      }
      
      if (filters?.instanceId) {
        query = query.eq('instance_id', filters.instanceId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Client-side search filter
      let result = data as WhatsappConversation[];
      
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(conv => 
          conv.contact?.name?.toLowerCase().includes(searchLower) ||
          conv.contact?.phone_number?.includes(searchLower) ||
          conv.last_message_preview?.toLowerCase().includes(searchLower)
        );
      }
      
      // Client-side sort
      if (filters?.sortBy === 'unread') {
        result.sort((a, b) => (b.unread_count || 0) - (a.unread_count || 0));
      } else if (filters?.sortBy === 'oldest') {
        result.sort((a, b) => 
          new Date(a.last_message_at || 0).getTime() - new Date(b.last_message_at || 0).getTime()
        );
      }
      
      return result;
    },
    enabled: !!codEmpresaAtiva,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Fetch messages for a conversation
export function useWhatsappMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['whatsapp-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return data as WhatsappMessage[];
    },
    enabled: !!conversationId,
  });
}

// Fetch single conversation with details
export function useWhatsappConversation(conversationId?: string) {
  return useQuery({
    queryKey: ['whatsapp-conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          contact:whatsapp_contacts(*),
          assigned_user:profiles!whatsapp_conversations_assigned_to_fkey(id, nome, email)
        `)
        .eq('id', conversationId)
        .single();
      
      if (error) throw error;
      return data as WhatsappConversation;
    },
    enabled: !!conversationId,
  });
}

// Fetch notes for a conversation
export function useWhatsappNotes(conversationId?: string) {
  return useQuery({
    queryKey: ['whatsapp-notes', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_conversation_notes')
        .select(`
          *,
          author:profiles!whatsapp_conversation_notes_created_by_fkey(id, nome, email)
        `)
        .eq('conversation_id', conversationId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WhatsappNote[];
    },
    enabled: !!conversationId,
  });
}

// Fetch instances
export function useWhatsappInstances() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  
  return useQuery({
    queryKey: ['whatsapp-instances', codEmpresaAtiva],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WhatsappInstance[];
    },
    enabled: !!codEmpresaAtiva,
  });
}

// Fetch macros
export function useWhatsappMacros() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  
  return useQuery({
    queryKey: ['whatsapp-macros', codEmpresaAtiva],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_macros')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      return data as WhatsappMacro[];
    },
    enabled: !!codEmpresaAtiva,
  });
}

// Mutations
export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      content, 
      messageType = 'text' 
    }: { 
      conversationId: string; 
      content: string;
      messageType?: WhatsappMessage['message_type'];
    }) => {
      // Call edge function to send message
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: { conversationId, content, messageType }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string | null }) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ 
          assigned_to: userId,
          status: userId ? 'active' : 'queue'
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation'] });
    },
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Get company_id from conversation
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('company_id')
        .eq('id', conversationId)
        .single();
      
      if (!conv) throw new Error('Conversation not found');
      
      const { error } = await supabase
        .from('whatsapp_conversation_notes')
        .insert({
          conversation_id: conversationId,
          company_id: conv.company_id,
          created_by: user.id,
          content
        });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-notes', variables.conversationId] });
    },
  });
}

// Analyze sentiment with OpenAI
export function useAnalyzeSentiment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
        body: { conversationId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });
}

// Realtime subscription for new messages
export function useWhatsappRealtime(conversationId?: string) {
  const queryClient = useQueryClient();
  
  // Subscribe to messages for the current conversation
  const subscribeToMessages = () => {
    if (!conversationId) return;
    
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversationId] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  };
  
  // Subscribe to conversation updates
  const subscribeToConversations = () => {
    const channel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  };
  
  // Subscribe to instance status updates
  const subscribeToInstances = () => {
    const channel = supabase
      .channel('instances')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_instances'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  };
  
  return { subscribeToMessages, subscribeToConversations, subscribeToInstances };
}
