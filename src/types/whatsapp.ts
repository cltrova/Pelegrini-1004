// Types for WhatsApp CRM Module

export interface WhatsappInstance {
  id: string;
  company_id: string;
  name: string;
  instance_name: string;
  api_url: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  qr_code?: string;
  phone_number?: string;
  phone_e164?: string;
  default_seller_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsappContact {
  id: string;
  company_id: string;
  instance_id?: string;
  remote_jid: string;
  phone_number?: string;
  name?: string;
  push_name?: string;
  profile_picture_url?: string;
  is_group: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsappConversation {
  id: string;
  company_id: string;
  instance_id?: string;
  contact_id: string;
  assigned_to?: string;
  status: 'active' | 'pending' | 'resolved' | 'closed' | 'queue';
  unread_count: number;
  last_message_at?: string;
  last_message_preview?: string;
  is_from_me: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_score?: number;
  topics?: string[];
  created_at: string;
  updated_at: string;
  // Joined relations
  contact?: WhatsappContact;
  assigned_user?: {
    id: string;
    nome?: string;
    email: string;
  };
}

export interface WhatsappMessage {
  id: string;
  company_id: string;
  conversation_id: string;
  contact_id?: string;
  message_id: string;
  remote_jid: string;
  from_me: boolean;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction';
  content?: string;
  media_url?: string;
  media_mimetype?: string;
  media_caption?: string;
  quoted_message_id?: string;
  quoted_content?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  is_edited: boolean;
  edited_at?: string;
  transcription?: string;
  created_at: string;
}

export interface WhatsappMacro {
  id: string;
  company_id: string;
  name: string;
  shortcut: string;
  content: string;
  category?: string;
  usage_count: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsappNote {
  id: string;
  company_id: string;
  conversation_id: string;
  created_by: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  author?: {
    id: string;
    nome?: string;
    email: string;
  };
}

export interface WhatsappSentimentAnalysis {
  id: string;
  company_id: string;
  conversation_id: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence_score?: number;
  summary?: string;
  topics?: string[];
  analyzed_at: string;
  analyzed_messages_count?: number;
  // Extended analysis fields
  satisfaction_level?: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  satisfaction_score?: number;
  satisfaction_indicators?: string[];
  sentiment_evolution?: 'improved' | 'stable' | 'worsened';
  service_quality_rating?: number;
  agent_tone?: 'professional' | 'friendly' | 'cold' | 'rude';
  empathy_level?: 'high' | 'medium' | 'low';
  solution_provided?: boolean;
  first_contact_resolution?: boolean;
  response_time_estimate?: 'fast' | 'moderate' | 'slow';
  conversation_flow?: 'smooth' | 'interrupted' | 'confusing';
  message_clarity?: 'clear' | 'moderate' | 'unclear';
  conversation_type?: 'support' | 'sales' | 'complaint' | 'inquiry' | 'feedback' | 'other';
  urgency_level?: 'high' | 'medium' | 'low';
  complexity?: 'simple' | 'moderate' | 'complex';
  resolution_status?: 'resolved' | 'partially_resolved' | 'unresolved' | 'pending';
  recommendations?: string[];
  key_moments?: { type: 'positive' | 'negative'; description: string }[];
  customer_intent?: string;
}

// Analysis result from edge function
export interface ConversationAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  sentimentEvolution?: 'improved' | 'stable' | 'worsened';
  topics: string[];
  summary: string;
  messagesAnalyzed: number;
  // Satisfaction
  satisfactionLevel?: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  satisfactionScore?: number;
  satisfactionIndicators?: string[];
  // Service quality
  serviceQualityRating?: number;
  agentTone?: 'professional' | 'friendly' | 'cold' | 'rude';
  empathyLevel?: 'high' | 'medium' | 'low';
  solutionProvided?: boolean;
  firstContactResolution?: boolean;
  // Response metrics
  responseTimeEstimate?: 'fast' | 'moderate' | 'slow';
  conversationFlow?: 'smooth' | 'interrupted' | 'confusing';
  messageClarity?: 'clear' | 'moderate' | 'unclear';
  // Context
  conversationType?: 'support' | 'sales' | 'complaint' | 'inquiry' | 'feedback' | 'other';
  urgencyLevel?: 'high' | 'medium' | 'low';
  complexity?: 'simple' | 'moderate' | 'complex';
  // Resolution
  resolutionStatus?: 'resolved' | 'partially_resolved' | 'unresolved' | 'pending';
  recommendations?: string[];
  keyMoments?: { type: 'positive' | 'negative'; description: string }[];
  customerIntent?: string;
}

export interface AssignmentRule {
  id: string;
  company_id: string;
  instance_id?: string;
  rule_type: 'fixed_agent' | 'round_robin';
  fixed_agent_id?: string;
  participating_agents?: string[];
  last_assigned_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Filter types
export interface ConversationFilters {
  search?: string;
  status?: WhatsappConversation['status'][];
  unreadOnly?: boolean;
  assignedToMe?: boolean;
  inQueue?: boolean;
  instanceId?: string;
  sortBy?: 'recent' | 'unread' | 'waiting' | 'oldest';
}

// UI State types
export interface ChatViewState {
  selectedConversationId?: string;
  isDetailsOpen: boolean;
  isComposing: boolean;
  replyingTo?: WhatsappMessage;
}
