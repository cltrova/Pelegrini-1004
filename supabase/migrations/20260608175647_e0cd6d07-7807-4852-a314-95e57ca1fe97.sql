
-- 1) IMPORTAÇÕES
CREATE TABLE public.autenticacao_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi TEXT NOT NULL,
  cod_filial TEXT,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  arquivo_tamanho INTEGER,
  data_ini DATE,
  data_fim DATE,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  total_autenticados INTEGER NOT NULL DEFAULT 0,
  total_divergentes INTEGER NOT NULL DEFAULT 0,
  total_nao_encontrados INTEGER NOT NULL DEFAULT 0,
  total_extras INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autenticacao_importacoes TO authenticated;
GRANT ALL ON public.autenticacao_importacoes TO service_role;
ALTER TABLE public.autenticacao_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_autenticacao_importacoes"
ON public.autenticacao_importacoes FOR SELECT
TO authenticated
USING (
  public.is_master_user()
  OR cod_empresa_bi = public.get_user_empresa()
);

CREATE POLICY "insert_autenticacao_importacoes"
ON public.autenticacao_importacoes FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa())
);

CREATE POLICY "update_autenticacao_importacoes"
ON public.autenticacao_importacoes FOR UPDATE
TO authenticated
USING (
  public.is_master_user()
  OR (usuario_id = auth.uid() AND cod_empresa_bi = public.get_user_empresa())
);

CREATE POLICY "delete_autenticacao_importacoes"
ON public.autenticacao_importacoes FOR DELETE
TO authenticated
USING (
  public.is_master_user()
  OR (usuario_id = auth.uid() AND cod_empresa_bi = public.get_user_empresa())
);

CREATE INDEX idx_auth_imp_empresa ON public.autenticacao_importacoes(cod_empresa_bi, created_at DESC);

CREATE TRIGGER trg_auth_imp_updated
BEFORE UPDATE ON public.autenticacao_importacoes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2) LINHAS DA PLANILHA
CREATE TABLE public.autenticacao_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.autenticacao_importacoes(id) ON DELETE CASCADE,
  numero_pedido TEXT NOT NULL,
  cliente TEXT,
  valor_planilha NUMERIC(18,2),
  data_pedido DATE,
  dados_extras JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autenticacao_linhas TO authenticated;
GRANT ALL ON public.autenticacao_linhas TO service_role;
ALTER TABLE public.autenticacao_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_autenticacao_linhas"
ON public.autenticacao_linhas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.autenticacao_importacoes i
    WHERE i.id = importacao_id
      AND (public.is_master_user() OR i.cod_empresa_bi = public.get_user_empresa())
  )
);

CREATE POLICY "insert_autenticacao_linhas"
ON public.autenticacao_linhas FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.autenticacao_importacoes i
    WHERE i.id = importacao_id
      AND i.usuario_id = auth.uid()
      AND (public.is_master_user() OR i.cod_empresa_bi = public.get_user_empresa())
  )
);

CREATE POLICY "delete_autenticacao_linhas"
ON public.autenticacao_linhas FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.autenticacao_importacoes i
    WHERE i.id = importacao_id
      AND (public.is_master_user() OR (i.usuario_id = auth.uid() AND i.cod_empresa_bi = public.get_user_empresa()))
  )
);

CREATE INDEX idx_auth_lin_imp ON public.autenticacao_linhas(importacao_id);

-- 3) RESULTADOS DA COMPARAÇÃO
CREATE TABLE public.autenticacao_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.autenticacao_importacoes(id) ON DELETE CASCADE,
  numero_pedido TEXT NOT NULL,
  cliente_planilha TEXT,
  cliente_sistema TEXT,
  valor_planilha NUMERIC(18,2),
  valor_sistema NUMERIC(18,2),
  status TEXT NOT NULL,
  divergencias JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autenticacao_resultados TO authenticated;
GRANT ALL ON public.autenticacao_resultados TO service_role;
ALTER TABLE public.autenticacao_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_autenticacao_resultados"
ON public.autenticacao_resultados FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.autenticacao_importacoes i
    WHERE i.id = importacao_id
      AND (public.is_master_user() OR i.cod_empresa_bi = public.get_user_empresa())
  )
);

CREATE POLICY "insert_autenticacao_resultados"
ON public.autenticacao_resultados FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.autenticacao_importacoes i
    WHERE i.id = importacao_id
      AND i.usuario_id = auth.uid()
      AND (public.is_master_user() OR i.cod_empresa_bi = public.get_user_empresa())
  )
);

CREATE POLICY "delete_autenticacao_resultados"
ON public.autenticacao_resultados FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.autenticacao_importacoes i
    WHERE i.id = importacao_id
      AND (public.is_master_user() OR (i.usuario_id = auth.uid() AND i.cod_empresa_bi = public.get_user_empresa()))
  )
);

CREATE INDEX idx_auth_res_imp_status ON public.autenticacao_resultados(importacao_id, status);
