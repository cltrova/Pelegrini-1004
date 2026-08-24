-- Tabela de configuração de linhas da DFC por empresa
CREATE TABLE public.dfc_line_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi text NOT NULL,
  linha_id text NOT NULL,
  descricao text NOT NULL,
  secao text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT 'banco' CHECK (fonte IN ('banco','contas')),
  grupo text,
  contas text[] NOT NULL DEFAULT ARRAY[]::text[],
  invert_sinal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cod_empresa_bi, linha_id)
);

CREATE INDEX idx_dfc_line_config_empresa ON public.dfc_line_config(cod_empresa_bi);

ALTER TABLE public.dfc_line_config ENABLE ROW LEVEL SECURITY;

-- Master ou usuário da empresa pode ler
CREATE POLICY "Read dfc_line_config by company"
ON public.dfc_line_config
FOR SELECT
USING (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa());

-- Master ou gerencial da empresa pode gravar
CREATE POLICY "Manage dfc_line_config by company"
ON public.dfc_line_config
FOR ALL
USING (
  public.is_master_user()
  OR (public.is_gerencial_user() AND cod_empresa_bi = public.get_user_empresa())
)
WITH CHECK (
  public.is_master_user()
  OR (public.is_gerencial_user() AND cod_empresa_bi = public.get_user_empresa())
);

-- Trigger updated_at
CREATE TRIGGER trg_dfc_line_config_updated_at
BEFORE UPDATE ON public.dfc_line_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();