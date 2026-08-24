CREATE TABLE public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi text NOT NULL,
  nome text NOT NULL,
  marca text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  meta_valor numeric NOT NULL DEFAULT 0,
  premiacao text,
  descricao text,
  status text NOT NULL DEFAULT 'ativa',
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campanhas_empresa ON public.campanhas(cod_empresa_bi);
CREATE INDEX idx_campanhas_periodo ON public.campanhas(data_inicio, data_fim);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

-- SELECT: master ou usuários da mesma empresa
CREATE POLICY "Campanhas visíveis por empresa ou master"
ON public.campanhas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR cod_empresa_bi IN (
    SELECT p.cod_empresa_bi FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- INSERT: master ou gerencial
CREATE POLICY "Master ou gerencial podem criar campanhas"
ON public.campanhas FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'master')
  OR public.has_role(auth.uid(), 'gerencial')
);

-- UPDATE: master ou gerencial da mesma empresa
CREATE POLICY "Master ou gerencial podem editar campanhas"
ON public.campanhas FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR (
    public.has_role(auth.uid(), 'gerencial')
    AND cod_empresa_bi IN (SELECT p.cod_empresa_bi FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- DELETE: master ou gerencial da mesma empresa
CREATE POLICY "Master ou gerencial podem excluir campanhas"
ON public.campanhas FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR (
    public.has_role(auth.uid(), 'gerencial')
    AND cod_empresa_bi IN (SELECT p.cod_empresa_bi FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- Trigger updated_at
CREATE TRIGGER trg_campanhas_updated_at
BEFORE UPDATE ON public.campanhas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();