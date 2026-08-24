
CREATE TABLE IF NOT EXISTS public.metas_vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_empresa_bi TEXT NOT NULL,
  cod_vendedor TEXT NOT NULL,
  nome_vendedor TEXT,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_valor NUMERIC NOT NULL DEFAULT 0,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cod_empresa_bi, cod_vendedor, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_vendedores TO authenticated;
GRANT ALL ON public.metas_vendedores TO service_role;

ALTER TABLE public.metas_vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_vendedores_select_authenticated"
  ON public.metas_vendedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "metas_vendedores_modify_authenticated"
  ON public.metas_vendedores FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_metas_vendedores_updated_at ON public.metas_vendedores;
CREATE TRIGGER trg_metas_vendedores_updated_at
BEFORE UPDATE ON public.metas_vendedores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_metas_vendedores_empresa_periodo
  ON public.metas_vendedores (cod_empresa_bi, ano, mes);
