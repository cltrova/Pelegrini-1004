ALTER TABLE public.whatsapp_agent_broadcasts
ADD COLUMN IF NOT EXISTS routing_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;