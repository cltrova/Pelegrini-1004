-- =============================================
-- WHATSAPP CRM MODULE - DATABASE STRUCTURE
-- =============================================

-- Adicionar coluna modulo_whatsapp na tabela empresas (se não existir)
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS modulo_whatsapp boolean DEFAULT false;

-- =============================================
-- TABELA: whatsapp_instances
-- Instâncias de conexão com WhatsApp (Evolution API)
-- =============================================
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  name text NOT NULL,
  instance_name text NOT NULL,
  api_url text NOT NULL,
  status text DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting', 'qr_pending')),
  qr_code text,
  phone_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- TABELA: whatsapp_instance_secrets
-- Credenciais das instâncias (API Keys)
-- =============================================
CREATE TABLE public.whatsapp_instance_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- TABELA: whatsapp_contacts
-- Contatos do WhatsApp
-- =============================================
CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  remote_jid text NOT NULL,
  phone_number text,
  name text,
  push_name text,
  profile_picture_url text,
  is_group boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, remote_jid)
);

-- =============================================
-- TABELA: whatsapp_conversations
-- Conversas (threads)
-- =============================================
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'resolved', 'closed', 'queue')),
  unread_count integer DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  is_from_me boolean DEFAULT false,
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  sentiment_score numeric(3,2),
  topics text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- TABELA: whatsapp_messages
-- Mensagens
-- =============================================
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  message_id text NOT NULL,
  remote_jid text NOT NULL,
  from_me boolean DEFAULT false,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'reaction')),
  content text,
  media_url text,
  media_mimetype text,
  media_caption text,
  quoted_message_id text,
  quoted_content text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  timestamp timestamptz NOT NULL,
  is_edited boolean DEFAULT false,
  edited_at timestamptz,
  transcription text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, message_id)
);

-- =============================================
-- TABELA: whatsapp_macros
-- Atalhos de texto
-- =============================================
CREATE TABLE public.whatsapp_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  name text NOT NULL,
  shortcut text NOT NULL,
  content text NOT NULL,
  category text,
  usage_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- TABELA: whatsapp_conversation_notes
-- Notas internas sobre conversas
-- =============================================
CREATE TABLE public.whatsapp_conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- TABELA: whatsapp_sentiment_analysis
-- Análises de sentimento via IA
-- =============================================
CREATE TABLE public.whatsapp_sentiment_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  sentiment text NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  confidence_score numeric(3,2),
  summary text,
  topics text[],
  analyzed_at timestamptz DEFAULT now(),
  analyzed_messages_count integer
);

-- =============================================
-- TABELA: assignment_rules
-- Regras de atribuição automática
-- =============================================
CREATE TABLE public.assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('fixed_agent', 'round_robin')),
  fixed_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  participating_agents uuid[],
  last_assigned_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- INDEXES para performance
-- =============================================
CREATE INDEX idx_whatsapp_instances_company ON public.whatsapp_instances(company_id);
CREATE INDEX idx_whatsapp_contacts_company ON public.whatsapp_contacts(company_id);
CREATE INDEX idx_whatsapp_contacts_remote_jid ON public.whatsapp_contacts(remote_jid);
CREATE INDEX idx_whatsapp_conversations_company ON public.whatsapp_conversations(company_id);
CREATE INDEX idx_whatsapp_conversations_contact ON public.whatsapp_conversations(contact_id);
CREATE INDEX idx_whatsapp_conversations_assigned ON public.whatsapp_conversations(assigned_to);
CREATE INDEX idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX idx_whatsapp_conversations_last_msg ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_timestamp ON public.whatsapp_messages(timestamp DESC);
CREATE INDEX idx_whatsapp_messages_company ON public.whatsapp_messages(company_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Habilitar RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instance_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

-- Função helper para verificar acesso à empresa
CREATE OR REPLACE FUNCTION public.can_access_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_master_user() 
    OR EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = p_company_id 
      AND e.cod_empresa_bi = public.get_user_empresa()
    )
$$;

-- Policies para whatsapp_instances
CREATE POLICY "Users can view instances of their company"
ON public.whatsapp_instances FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Masters can manage instances"
ON public.whatsapp_instances FOR ALL
USING (public.is_master_user())
WITH CHECK (public.is_master_user());

-- Policies para whatsapp_instance_secrets
CREATE POLICY "Masters can manage instance secrets"
ON public.whatsapp_instance_secrets FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi
    WHERE wi.id = instance_id AND public.can_access_company(wi.company_id)
  )
);

-- Policies para whatsapp_contacts
CREATE POLICY "Users can view contacts of their company"
ON public.whatsapp_contacts FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Users can manage contacts of their company"
ON public.whatsapp_contacts FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

-- Policies para whatsapp_conversations
CREATE POLICY "Users can view conversations of their company"
ON public.whatsapp_conversations FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Users can manage conversations of their company"
ON public.whatsapp_conversations FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

-- Policies para whatsapp_messages
CREATE POLICY "Users can view messages of their company"
ON public.whatsapp_messages FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Users can manage messages of their company"
ON public.whatsapp_messages FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

-- Policies para whatsapp_macros
CREATE POLICY "Users can view macros of their company"
ON public.whatsapp_macros FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Users can manage macros of their company"
ON public.whatsapp_macros FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

-- Policies para whatsapp_conversation_notes
CREATE POLICY "Users can view notes of their company"
ON public.whatsapp_conversation_notes FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Users can manage notes of their company"
ON public.whatsapp_conversation_notes FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

-- Policies para whatsapp_sentiment_analysis
CREATE POLICY "Users can view analysis of their company"
ON public.whatsapp_sentiment_analysis FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Users can manage analysis of their company"
ON public.whatsapp_sentiment_analysis FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

-- Policies para assignment_rules
CREATE POLICY "Users can view rules of their company"
ON public.assignment_rules FOR SELECT
USING (public.can_access_company(company_id));

CREATE POLICY "Masters can manage assignment rules"
ON public.assignment_rules FOR ALL
USING (public.is_master_user())
WITH CHECK (public.is_master_user());

-- =============================================
-- TRIGGERS para updated_at
-- =============================================
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_whatsapp_macros_updated_at
  BEFORE UPDATE ON public.whatsapp_macros
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_whatsapp_conversation_notes_updated_at
  BEFORE UPDATE ON public.whatsapp_conversation_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_assignment_rules_updated_at
  BEFORE UPDATE ON public.assignment_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- ENABLE REALTIME para mensagens e conversas
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;