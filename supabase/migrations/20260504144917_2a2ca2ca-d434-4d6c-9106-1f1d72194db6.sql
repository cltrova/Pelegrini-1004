ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS marcas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_geral_mensal NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_meta_geral NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mensagem_equipe TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE public.campanhas
  ALTER COLUMN marca DROP NOT NULL,
  ALTER COLUMN meta_valor DROP NOT NULL;

COMMENT ON COLUMN public.campanhas.marcas IS 'Array de objetos: [{ marca, meta_mensal, percentual_premio, premio_fixo }]';
COMMENT ON COLUMN public.campanhas.meta_geral_mensal IS 'Meta geral mensal da empresa para esta campanha';
COMMENT ON COLUMN public.campanhas.bonus_meta_geral IS 'Bônus fixo pago se a meta geral for atingida';