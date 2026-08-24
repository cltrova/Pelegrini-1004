
CREATE TABLE public.estoque_assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi TEXT NOT NULL UNIQUE,
  custom_prompt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_assistant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read config"
  ON public.estoque_assistant_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert config"
  ON public.estoque_assistant_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update config"
  ON public.estoque_assistant_config FOR UPDATE
  TO authenticated
  USING (true);

CREATE TRIGGER update_estoque_assistant_config_updated_at
  BEFORE UPDATE ON public.estoque_assistant_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
