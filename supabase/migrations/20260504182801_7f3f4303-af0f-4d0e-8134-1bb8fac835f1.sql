
-- Tabela de intervenções/acompanhamento do agente
CREATE TABLE public.cobranca_intervencoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_empresa_bi TEXT NOT NULL,
  conversation_id UUID NULL,
  instance_id UUID NULL,
  contact_phone TEXT NULL,
  cliente_nome TEXT NULL,
  cod_cliente TEXT NULL,
  pedido_numero TEXT NULL,
  duplicata_id TEXT NULL,
  valor NUMERIC NULL,
  data_vencimento DATE NULL,
  tipo TEXT NOT NULL DEFAULT 'outro', -- pix, boleto, segunda_via, negociacao, comprovante, outro
  prioridade TEXT NOT NULL DEFAULT 'normal', -- baixa, normal, alta
  agent_summary TEXT NOT NULL DEFAULT '',
  ultima_mensagem_cliente TEXT NULL,
  user_response TEXT NULL,
  attachment_url TEXT NULL,
  attachment_type TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, respondido, resolvido, cancelado
  resolved_by UUID NULL,
  resolved_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobranca_intervencoes_empresa_status ON public.cobranca_intervencoes(cod_empresa_bi, status, created_at DESC);

ALTER TABLE public.cobranca_intervencoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read intervencoes by company"
ON public.cobranca_intervencoes FOR SELECT
USING (is_master_user() OR cod_empresa_bi = get_user_empresa());

CREATE POLICY "Insert intervencoes by company"
ON public.cobranca_intervencoes FOR INSERT
WITH CHECK (is_master_user() OR cod_empresa_bi = get_user_empresa());

CREATE POLICY "Update intervencoes by company"
ON public.cobranca_intervencoes FOR UPDATE
USING (is_master_user() OR cod_empresa_bi = get_user_empresa())
WITH CHECK (is_master_user() OR cod_empresa_bi = get_user_empresa());

CREATE TRIGGER trg_cobranca_intervencoes_updated
BEFORE UPDATE ON public.cobranca_intervencoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.cobranca_intervencoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cobranca_intervencoes;

-- Storage bucket para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('cobranca-anexos', 'cobranca-anexos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read cobranca-anexos"
ON storage.objects FOR SELECT
USING (bucket_id = 'cobranca-anexos');

CREATE POLICY "Authenticated upload cobranca-anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cobranca-anexos');

CREATE POLICY "Authenticated update cobranca-anexos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'cobranca-anexos');
