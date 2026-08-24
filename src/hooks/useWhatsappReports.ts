import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from './useEmpresaAtiva';

export interface ReportFilters {
  anos: string[];
  meses: string[];
  vendedorId: string | null;
}

export interface ConversationStats {
  total: number;
  active: number;
  pending: number;
  resolved: number;
  closed: number;
  queue: number;
}

export interface SentimentStats {
  positive: number;
  neutral: number;
  negative: number;
  averageScore: number;
}

export interface SatisfactionStats {
  verySatisfied: number;
  satisfied: number;
  neutral: number;
  dissatisfied: number;
  veryDissatisfied: number;
  averageScore: number;
}

export interface ServiceQualityStats {
  averageRating: number;
  solutionProvidedRate: number;
  firstContactResolutionRate: number;
  agentTone: {
    professional: number;
    friendly: number;
    cold: number;
    rude: number;
  };
  empathyLevel: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface ResponseMetrics {
  fast: number;
  moderate: number;
  slow: number;
}

export interface ConversationTypeStats {
  support: number;
  sales: number;
  complaint: number;
  inquiry: number;
  feedback: number;
  other: number;
}

export interface UrgencyStats {
  high: number;
  medium: number;
  low: number;
}

export interface ResolutionStats {
  resolved: number;
  partiallyResolved: number;
  unresolved: number;
  pending: number;
}

export interface ClientReport {
  contactId: string;
  contactName: string;
  phoneNumber: string;
  conversationsCount: number;
  lastContact: string;
  sentiment: string;
  satisfactionLevel: string;
  topics: string[];
  resolutionStatus: string;
  latestConversationId: string | null;
  hasAnalysis: boolean;
  summary: string | null;
}

export interface AgentReport {
  agentId: string;
  agentName: string;
  agentEmail: string;
  phoneNumber?: string;
  status: 'active' | 'pending_login';
  conversationsHandled: number;
  resolvedCount: number;
  unresolvedCount: number;
  averageSatisfactionScore: number;
  averageServiceQuality: number;
  responseTimeDistribution: ResponseMetrics;
  sentimentDistribution: SentimentStats;
  empathyDistribution: { high: number; medium: number; low: number };
  toneDistribution: { professional: number; friendly: number; cold: number; rude: number };
  firstContactResolutionRate: number;
  solutionProvidedRate: number;
}

export interface ReportSummary {
  conversationStats: ConversationStats;
  sentimentStats: SentimentStats;
  satisfactionStats: SatisfactionStats;
  serviceQualityStats: ServiceQualityStats;
  responseMetrics: ResponseMetrics;
  conversationTypeStats: ConversationTypeStats;
  urgencyStats: UrgencyStats;
  resolutionStats: ResolutionStats;
  totalClients: number;
  totalAgents: number;
  analyzedConversations: number;
}

// Helper function to filter data by date range
function isInDateRange(date: string | null, anos: string[], meses: string[]): boolean {
  if (!date) return false;
  
  // If no filters, include all
  if (anos.length === 0 && meses.length === 0) return true;
  
  const d = new Date(date);
  const year = d.getFullYear().toString();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  
  const yearMatch = anos.length === 0 || anos.includes(year);
  const monthMatch = meses.length === 0 || meses.includes(month);
  
  return yearMatch && monthMatch;
}

export function useWhatsappReportSummary(filters?: ReportFilters) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;

  return useQuery({
    queryKey: ['whatsapp-report-summary', empresaId, filters],
    queryFn: async (): Promise<ReportSummary> => {
      if (!empresaId) throw new Error('No company selected');

      // Fetch conversations
      let conversationsQuery = supabase
        .from('whatsapp_conversations')
        .select('id, status, contact_id, assigned_to, sentiment, sentiment_score, last_message_at')
        .eq('company_id', empresaId);
      
      // Filter by vendedor if specified
      if (filters?.vendedorId) {
        conversationsQuery = conversationsQuery.eq('assigned_to', filters.vendedorId);
      }

      const { data: allConversations, error: convError } = await conversationsQuery;

      if (convError) throw convError;

      // Apply date filter on conversations
      const conversations = (allConversations || []).filter(c => 
        isInDateRange(c.last_message_at, filters?.anos || [], filters?.meses || [])
      );

      // Fetch sentiment analysis
      const { data: rawAnalyses, error: analysisError } = await supabase
        .from('whatsapp_sentiment_analysis')
        .select('*')
        .eq('company_id', empresaId);

      if (analysisError) throw analysisError;

      // Filter analyses by conversation ids that match the date filter
      const conversationIds = new Set(conversations.map(c => c.id));
      
      // Deduplicate analyses - keep only the most recent per conversation
      const latestAnalysesMap = (rawAnalyses || []).reduce((acc, analysis) => {
        // Only include if the conversation is in our filtered set
        if (!conversationIds.has(analysis.conversation_id)) return acc;
        
        const existing = acc[analysis.conversation_id];
        if (!existing || new Date(analysis.analyzed_at) > new Date(existing.analyzed_at)) {
          acc[analysis.conversation_id] = analysis;
        }
        return acc;
      }, {} as Record<string, any>);
      const analyses = Object.values(latestAnalysesMap);

      // Fetch unique contacts from filtered conversations
      const contactIds = [...new Set(conversations.map(c => c.contact_id))];

      // Fetch active sellers from whitelist (registered sellers)
      const { data: whitelist, error: whitelistError } = await supabase
        .from('seller_whitelist')
        .select('id')
        .eq('company_id', empresaId)
        .eq('is_active', true);

      if (whitelistError) throw whitelistError;

      const totalActiveAgents = whitelist?.length || 0;

      // Calculate conversation stats
      const convStats: ConversationStats = {
        total: conversations?.length || 0,
        active: conversations?.filter(c => c.status === 'active').length || 0,
        pending: conversations?.filter(c => c.status === 'pending').length || 0,
        resolved: conversations?.filter(c => c.status === 'resolved').length || 0,
        closed: conversations?.filter(c => c.status === 'closed').length || 0,
        queue: conversations?.filter(c => c.status === 'queue').length || 0,
      };

      // Calculate sentiment stats from analyses
      const sentimentCounts = {
        positive: analyses?.filter(a => a.sentiment === 'positive').length || 0,
        neutral: analyses?.filter(a => a.sentiment === 'neutral').length || 0,
        negative: analyses?.filter(a => a.sentiment === 'negative').length || 0,
      };
      const avgSentimentScore = analyses?.length 
        ? analyses.reduce((sum, a) => sum + (a.confidence_score || 0), 0) / analyses.length 
        : 0;

      // Calculate satisfaction stats
      const satisfactionCounts = {
        verySatisfied: analyses?.filter(a => a.satisfaction_level === 'very_satisfied').length || 0,
        satisfied: analyses?.filter(a => a.satisfaction_level === 'satisfied').length || 0,
        neutral: analyses?.filter(a => a.satisfaction_level === 'neutral').length || 0,
        dissatisfied: analyses?.filter(a => a.satisfaction_level === 'dissatisfied').length || 0,
        veryDissatisfied: analyses?.filter(a => a.satisfaction_level === 'very_dissatisfied').length || 0,
      };
      const avgSatisfactionScore = analyses?.filter(a => a.satisfaction_score)?.length
        ? analyses.filter(a => a.satisfaction_score).reduce((sum, a) => sum + (a.satisfaction_score || 0), 0) / analyses.filter(a => a.satisfaction_score).length
        : 0;

      // Calculate service quality stats
      const analyzedWithQuality = analyses?.filter(a => a.service_quality_rating) || [];
      const avgQualityRating = analyzedWithQuality.length
        ? analyzedWithQuality.reduce((sum, a) => sum + (a.service_quality_rating || 0), 0) / analyzedWithQuality.length
        : 0;
      const solutionProvidedRate = analyses?.length
        ? (analyses.filter(a => a.solution_provided === true).length / analyses.length) * 100
        : 0;
      const fcrRate = analyses?.length
        ? (analyses.filter(a => a.first_contact_resolution === true).length / analyses.length) * 100
        : 0;

      const agentToneCounts = {
        professional: analyses?.filter(a => a.agent_tone === 'professional').length || 0,
        friendly: analyses?.filter(a => a.agent_tone === 'friendly').length || 0,
        cold: analyses?.filter(a => a.agent_tone === 'cold').length || 0,
        rude: analyses?.filter(a => a.agent_tone === 'rude').length || 0,
      };

      const empathyCounts = {
        high: analyses?.filter(a => a.empathy_level === 'high').length || 0,
        medium: analyses?.filter(a => a.empathy_level === 'medium').length || 0,
        low: analyses?.filter(a => a.empathy_level === 'low').length || 0,
      };

      // Calculate response metrics
      const responseMetrics: ResponseMetrics = {
        fast: analyses?.filter(a => a.response_time_estimate === 'fast').length || 0,
        moderate: analyses?.filter(a => a.response_time_estimate === 'moderate').length || 0,
        slow: analyses?.filter(a => a.response_time_estimate === 'slow').length || 0,
      };

      // Calculate conversation type stats
      const typeStats: ConversationTypeStats = {
        support: analyses?.filter(a => a.conversation_type === 'support').length || 0,
        sales: analyses?.filter(a => a.conversation_type === 'sales').length || 0,
        complaint: analyses?.filter(a => a.conversation_type === 'complaint').length || 0,
        inquiry: analyses?.filter(a => a.conversation_type === 'inquiry').length || 0,
        feedback: analyses?.filter(a => a.conversation_type === 'feedback').length || 0,
        other: analyses?.filter(a => a.conversation_type === 'other').length || 0,
      };

      // Calculate urgency stats
      const urgencyStats: UrgencyStats = {
        high: analyses?.filter(a => a.urgency_level === 'high').length || 0,
        medium: analyses?.filter(a => a.urgency_level === 'medium').length || 0,
        low: analyses?.filter(a => a.urgency_level === 'low').length || 0,
      };

      // Calculate resolution stats
      const resolutionStats: ResolutionStats = {
        resolved: analyses?.filter(a => a.resolution_status === 'resolved').length || 0,
        partiallyResolved: analyses?.filter(a => a.resolution_status === 'partially_resolved').length || 0,
        unresolved: analyses?.filter(a => a.resolution_status === 'unresolved').length || 0,
        pending: analyses?.filter(a => a.resolution_status === 'pending').length || 0,
      };

      return {
        conversationStats: convStats,
        sentimentStats: {
          ...sentimentCounts,
          averageScore: avgSentimentScore,
        },
        satisfactionStats: {
          ...satisfactionCounts,
          averageScore: avgSatisfactionScore,
        },
        serviceQualityStats: {
          averageRating: avgQualityRating,
          solutionProvidedRate,
          firstContactResolutionRate: fcrRate,
          agentTone: agentToneCounts,
          empathyLevel: empathyCounts,
        },
        responseMetrics,
        conversationTypeStats: typeStats,
        urgencyStats,
        resolutionStats,
        totalClients: contactIds.length,
        totalAgents: totalActiveAgents,
        analyzedConversations: analyses?.length || 0,
      };
    },
    enabled: !!empresaId,
  });
}

export function useWhatsappClientReports(filters?: ReportFilters) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;

  return useQuery({
    queryKey: ['whatsapp-client-reports', empresaId, filters],
    queryFn: async (): Promise<ClientReport[]> => {
      if (!empresaId) throw new Error('No company selected');

      // Fetch contacts with their conversations
      const { data: contacts, error: contactsError } = await supabase
        .from('whatsapp_contacts')
        .select('id, name, push_name, phone_number')
        .eq('company_id', empresaId);

      if (contactsError) throw contactsError;

      // Fetch conversations with optional vendedor filter
      let conversationsQuery = supabase
        .from('whatsapp_conversations')
        .select('id, contact_id, status, last_message_at, sentiment, topics, assigned_to')
        .eq('company_id', empresaId);
      
      if (filters?.vendedorId) {
        conversationsQuery = conversationsQuery.eq('assigned_to', filters.vendedorId);
      }

      const { data: allConversations, error: convError } = await conversationsQuery;

      if (convError) throw convError;

      // Apply date filter
      const conversations = (allConversations || []).filter(c => 
        isInDateRange(c.last_message_at, filters?.anos || [], filters?.meses || [])
      );

      // Fetch latest analysis per conversation with summary
      const { data: analyses, error: analysisError } = await supabase
        .from('whatsapp_sentiment_analysis')
        .select('conversation_id, satisfaction_level, resolution_status, analyzed_at, summary')
        .eq('company_id', empresaId)
        .order('analyzed_at', { ascending: false });

      if (analysisError) throw analysisError;

      // Group by contact
      const clientReports: ClientReport[] = (contacts || []).map(contact => {
        const contactConversations = conversations?.filter(c => c.contact_id === contact.id) || [];
        const latestConversation = contactConversations.sort((a, b) => 
          new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        )[0];

        // Get latest analysis for this contact's conversations
        const conversationIds = contactConversations.map(c => c.id);
        const latestAnalysis = analyses?.find(a => conversationIds.includes(a.conversation_id));

        // Collect all topics
        const allTopics = contactConversations.flatMap(c => c.topics || []);
        const uniqueTopics = [...new Set(allTopics)];

        return {
          contactId: contact.id,
          contactName: contact.name || contact.push_name || 'Desconhecido',
          phoneNumber: contact.phone_number || '',
          conversationsCount: contactConversations.length,
          lastContact: latestConversation?.last_message_at || '',
          sentiment: latestConversation?.sentiment || 'neutral',
          satisfactionLevel: latestAnalysis?.satisfaction_level || 'neutral',
          topics: uniqueTopics.slice(0, 5),
          resolutionStatus: latestAnalysis?.resolution_status || 'pending',
          latestConversationId: latestConversation?.id || null,
          hasAnalysis: !!latestAnalysis,
          summary: latestAnalysis?.summary || null,
        };
      }).filter(c => c.conversationsCount > 0);

      return clientReports.sort((a, b) => 
        new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()
      );
    },
    enabled: !!empresaId,
  });
}

export function useWhatsappAgentReports(filters?: ReportFilters) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id;
  const codEmpresaBi = empresa?.cod_empresa_bi;

  return useQuery({
    queryKey: ['whatsapp-agent-reports', empresaId, codEmpresaBi, filters],
    queryFn: async (): Promise<AgentReport[]> => {
      if (!empresaId) throw new Error('No company selected');

      // 1. Fetch sellers from whitelist (may not have profiles yet)
      const { data: whitelist, error: whitelistError } = await supabase
        .from('seller_whitelist')
        .select('id, phone_e164, name, is_active')
        .eq('company_id', empresaId)
        .eq('is_active', true);

      if (whitelistError) throw whitelistError;

      // 2. Fetch ALL users with vendedor or gerencial roles for this company
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vendedor', 'gerencial']);

      if (rolesError) throw rolesError;

      // 3. Fetch profiles for these users, filtered by company
      const userIds = userRoles?.map(r => r.user_id) || [];
      
      let profiles: { id: string; user_id: string; nome: string | null; email: string; cod_empresa_bi: string | null; phone_e164: string | null }[] = [];
      
      if (userIds.length > 0) {
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, nome, email, cod_empresa_bi, phone_e164')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;
        
        // Filter by company code (or include all if master company)
        profiles = (allProfiles || []).filter(p => 
          p.cod_empresa_bi === codEmpresaBi || !codEmpresaBi
        );
      }

      // If specific vendedor filter is set, filter profiles
      if (filters?.vendedorId) {
        profiles = profiles.filter(p => p.id === filters.vendedorId);
      }

      // Fetch ALL conversations for this company
      let conversationsQuery = supabase
        .from('whatsapp_conversations')
        .select('id, assigned_to, status, sentiment, last_message_at')
        .eq('company_id', empresaId);

      const { data: allConversations, error: convError } = await conversationsQuery;

      if (convError) throw convError;

      // Apply date filter
      const conversations = (allConversations || []).filter(c => 
        isInDateRange(c.last_message_at, filters?.anos || [], filters?.meses || [])
      );

      // Fetch analyses for all conversations
      const conversationIds = conversations?.map(c => c.id) || [];
      let analyses: any[] = [];
      
      if (conversationIds.length > 0) {
        const { data: analysesData, error: analysisError } = await supabase
          .from('whatsapp_sentiment_analysis')
          .select('*')
          .eq('company_id', empresaId)
          .in('conversation_id', conversationIds);

        if (analysisError) throw analysisError;
        
        // Deduplicate analyses - keep only the most recent per conversation
        const latestAnalysesMap = (analysesData || []).reduce((acc, analysis) => {
          const existing = acc[analysis.conversation_id];
          if (!existing || new Date(analysis.analyzed_at) > new Date(existing.analyzed_at)) {
            acc[analysis.conversation_id] = analysis;
          }
          return acc;
        }, {} as Record<string, any>);
        
        analyses = Object.values(latestAnalysesMap);
      }

      // Build agent reports for ALL vendedores/gerenciais that have phone numbers
      // Profiles without phone numbers should not appear in the sellers report
      const profilesWithPhone = profiles.filter(p => p.phone_e164 && p.phone_e164.trim() !== '');
      
      const agentReports: AgentReport[] = profilesWithPhone.map(profile => {
        // Get conversations assigned to this agent (by profile.id)
        const agentConversations = conversations?.filter(c => c.assigned_to === profile.id) || [];
        const agentConversationIds = agentConversations.map(c => c.id);
        const agentAnalyses = analyses.filter(a => agentConversationIds.includes(a.conversation_id));

        // Calculate metrics
        const resolvedCount = agentAnalyses.filter(a => a.resolution_status === 'resolved').length;
        const unresolvedCount = agentAnalyses.filter(a => a.resolution_status === 'unresolved').length;

        const avgSatisfaction = agentAnalyses.filter(a => a.satisfaction_score).length
          ? agentAnalyses.filter(a => a.satisfaction_score).reduce((sum, a) => sum + (a.satisfaction_score || 0), 0) / agentAnalyses.filter(a => a.satisfaction_score).length
          : 0;

        const avgQuality = agentAnalyses.filter(a => a.service_quality_rating).length
          ? agentAnalyses.filter(a => a.service_quality_rating).reduce((sum, a) => sum + (a.service_quality_rating || 0), 0) / agentAnalyses.filter(a => a.service_quality_rating).length
          : 0;

        const fcrRate = agentAnalyses.length
          ? (agentAnalyses.filter(a => a.first_contact_resolution === true).length / agentAnalyses.length) * 100
          : 0;

        const solutionRate = agentAnalyses.length
          ? (agentAnalyses.filter(a => a.solution_provided === true).length / agentAnalyses.length) * 100
          : 0;

        return {
          agentId: profile.id,
          agentName: profile.nome || 'Sem nome',
          agentEmail: profile.email,
          phoneNumber: profile.phone_e164 || undefined,
          status: 'active' as const,
          conversationsHandled: agentConversations.length,
          resolvedCount,
          unresolvedCount,
          averageSatisfactionScore: avgSatisfaction,
          averageServiceQuality: avgQuality,
          responseTimeDistribution: {
            fast: agentAnalyses.filter(a => a.response_time_estimate === 'fast').length,
            moderate: agentAnalyses.filter(a => a.response_time_estimate === 'moderate').length,
            slow: agentAnalyses.filter(a => a.response_time_estimate === 'slow').length,
          },
          sentimentDistribution: {
            positive: agentAnalyses.filter(a => a.sentiment === 'positive').length,
            neutral: agentAnalyses.filter(a => a.sentiment === 'neutral').length,
            negative: agentAnalyses.filter(a => a.sentiment === 'negative').length,
            averageScore: 0,
          },
          empathyDistribution: {
            high: agentAnalyses.filter(a => a.empathy_level === 'high').length,
            medium: agentAnalyses.filter(a => a.empathy_level === 'medium').length,
            low: agentAnalyses.filter(a => a.empathy_level === 'low').length,
          },
          toneDistribution: {
            professional: agentAnalyses.filter(a => a.agent_tone === 'professional').length,
            friendly: agentAnalyses.filter(a => a.agent_tone === 'friendly').length,
            cold: agentAnalyses.filter(a => a.agent_tone === 'cold').length,
            rude: agentAnalyses.filter(a => a.agent_tone === 'rude').length,
          },
          firstContactResolutionRate: fcrRate,
          solutionProvidedRate: solutionRate,
        };
      });

      // Add sellers from whitelist that don't have profiles yet (only if no specific vendedor filter)
      if (!filters?.vendedorId) {
        const profilePhones = new Set(profiles.map(p => p.phone_e164).filter(Boolean));
        const profileIds = new Set(profiles.map(p => p.id));
        
        // Get unassigned conversations (not assigned to any known profile)
        const unassignedConversations = conversations?.filter(c => 
          !c.assigned_to || !profileIds.has(c.assigned_to)
        ) || [];
        const unassignedConversationIds = unassignedConversations.map(c => c.id);
        const unassignedAnalyses = analyses.filter(a => unassignedConversationIds.includes(a.conversation_id));
        
        for (const seller of whitelist || []) {
          if (!profilePhones.has(seller.phone_e164)) {
            const sellerAnalyses = unassignedAnalyses;
            
            const resolvedCount = sellerAnalyses.filter(a => a.resolution_status === 'resolved').length;
            const unresolvedCount = sellerAnalyses.filter(a => a.resolution_status === 'unresolved').length;
            
            const avgSatisfaction = sellerAnalyses.filter(a => a.satisfaction_score).length
              ? sellerAnalyses.filter(a => a.satisfaction_score).reduce((sum, a) => sum + (a.satisfaction_score || 0), 0) / sellerAnalyses.filter(a => a.satisfaction_score).length
              : 0;
            
            const avgQuality = sellerAnalyses.filter(a => a.service_quality_rating).length
              ? sellerAnalyses.filter(a => a.service_quality_rating).reduce((sum, a) => sum + (a.service_quality_rating || 0), 0) / sellerAnalyses.filter(a => a.service_quality_rating).length
              : 0;
            
            const fcrRate = sellerAnalyses.length
              ? (sellerAnalyses.filter(a => a.first_contact_resolution === true).length / sellerAnalyses.length) * 100
              : 0;
            
            const solutionRate = sellerAnalyses.length
              ? (sellerAnalyses.filter(a => a.solution_provided === true).length / sellerAnalyses.length) * 100
              : 0;
            
            agentReports.push({
              agentId: seller.id,
              agentName: seller.name || `Vendedor ${seller.phone_e164}`,
              agentEmail: '',
              phoneNumber: seller.phone_e164,
              status: 'pending_login',
              conversationsHandled: unassignedConversations.length,
              resolvedCount,
              unresolvedCount,
              averageSatisfactionScore: avgSatisfaction,
              averageServiceQuality: avgQuality,
              responseTimeDistribution: {
                fast: sellerAnalyses.filter(a => a.response_time_estimate === 'fast').length,
                moderate: sellerAnalyses.filter(a => a.response_time_estimate === 'moderate').length,
                slow: sellerAnalyses.filter(a => a.response_time_estimate === 'slow').length,
              },
              sentimentDistribution: {
                positive: sellerAnalyses.filter(a => a.sentiment === 'positive').length,
                neutral: sellerAnalyses.filter(a => a.sentiment === 'neutral').length,
                negative: sellerAnalyses.filter(a => a.sentiment === 'negative').length,
                averageScore: 0,
              },
              empathyDistribution: {
                high: sellerAnalyses.filter(a => a.empathy_level === 'high').length,
                medium: sellerAnalyses.filter(a => a.empathy_level === 'medium').length,
                low: sellerAnalyses.filter(a => a.empathy_level === 'low').length,
              },
              toneDistribution: {
                professional: sellerAnalyses.filter(a => a.agent_tone === 'professional').length,
                friendly: sellerAnalyses.filter(a => a.agent_tone === 'friendly').length,
                cold: sellerAnalyses.filter(a => a.agent_tone === 'cold').length,
                rude: sellerAnalyses.filter(a => a.agent_tone === 'rude').length,
              },
              firstContactResolutionRate: fcrRate,
              solutionProvidedRate: solutionRate,
            });
          }
        }
      }

      // Sort: active profiles first, then by conversations handled
      return agentReports.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return b.conversationsHandled - a.conversationsHandled;
      });
    },
    enabled: !!empresaId,
  });
}
