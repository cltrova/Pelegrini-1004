
-- 1) AGENTES
CREATE TABLE public.whatsapp_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  instance_id uuid,
  name text NOT NULL,
  description text,
  avatar_url text,
  phone_e164 text,
  persona_prompt text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'neutro',
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  supervises_clients boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_agents_company ON public.whatsapp_agents(company_id);
CREATE INDEX idx_wa_agents_instance ON public.whatsapp_agents(instance_id);
ALTER TABLE public.whatsapp_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View agents by company"
ON public.whatsapp_agents FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "Manage agents by company"
ON public.whatsapp_agents FOR ALL
USING (can_access_company(company_id) AND (is_master_user() OR is_gerencial_user()))
WITH CHECK (can_access_company(company_id) AND (is_master_user() OR is_gerencial_user()));

CREATE TRIGGER trg_wa_agents_updated_at
BEFORE UPDATE ON public.whatsapp_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) GRUPOS / DEPARTAMENTOS
CREATE TABLE public.whatsapp_agent_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.whatsapp_agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  default_for_topics text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_agent_groups_agent ON public.whatsapp_agent_groups(agent_id);
CREATE INDEX idx_wa_agent_groups_company ON public.whatsapp_agent_groups(company_id);
ALTER TABLE public.whatsapp_agent_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View agent groups by company"
ON public.whatsapp_agent_groups FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "Manage agent groups by company"
ON public.whatsapp_agent_groups FOR ALL
USING (can_access_company(company_id) AND (is_master_user() OR is_gerencial_user()))
WITH CHECK (can_access_company(company_id) AND (is_master_user() OR is_gerencial_user()));

CREATE TRIGGER trg_wa_agent_groups_updated_at
BEFORE UPDATE ON public.whatsapp_agent_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) MEMBROS DE GRUPO
CREATE TABLE public.whatsapp_agent_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.whatsapp_agent_groups(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  display_name text,
  user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, phone_e164)
);
CREATE INDEX idx_wa_agent_members_group ON public.whatsapp_agent_group_members(group_id);
CREATE INDEX idx_wa_agent_members_phone ON public.whatsapp_agent_group_members(phone_e164);
CREATE INDEX idx_wa_agent_members_company ON public.whatsapp_agent_group_members(company_id);
ALTER TABLE public.whatsapp_agent_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View agent members by company"
ON public.whatsapp_agent_group_members FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "Manage agent members by company"
ON public.whatsapp_agent_group_members FOR ALL
USING (can_access_company(company_id) AND (is_master_user() OR is_gerencial_user()))
WITH CHECK (can_access_company(company_id) AND (is_master_user() OR is_gerencial_user()));

-- 4) LOG DE BROADCASTS
CREATE TABLE public.whatsapp_agent_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.whatsapp_agents(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.whatsapp_agent_groups(id) ON DELETE SET NULL,
  company_id uuid NOT NULL,
  source_phone text,
  source_name text,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  delivered_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'internal_chat',
  related_conversation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_broadcasts_agent ON public.whatsapp_agent_broadcasts(agent_id, created_at DESC);
CREATE INDEX idx_wa_broadcasts_company ON public.whatsapp_agent_broadcasts(company_id, created_at DESC);
ALTER TABLE public.whatsapp_agent_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View broadcasts by company"
ON public.whatsapp_agent_broadcasts FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "Insert broadcasts by company"
ON public.whatsapp_agent_broadcasts FOR INSERT
WITH CHECK (can_access_company(company_id));

-- 5) INTERVENÇÕES DO SUPERVISOR
CREATE TABLE public.whatsapp_agent_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.whatsapp_agents(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  company_id uuid NOT NULL,
  rule_triggered text NOT NULL,
  action_taken text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_interventions_agent ON public.whatsapp_agent_interventions(agent_id, created_at DESC);
CREATE INDEX idx_wa_interventions_conv ON public.whatsapp_agent_interventions(conversation_id);
CREATE INDEX idx_wa_interventions_company ON public.whatsapp_agent_interventions(company_id, created_at DESC);
ALTER TABLE public.whatsapp_agent_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View interventions by company"
ON public.whatsapp_agent_interventions FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "Manage interventions by company"
ON public.whatsapp_agent_interventions FOR ALL
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));
