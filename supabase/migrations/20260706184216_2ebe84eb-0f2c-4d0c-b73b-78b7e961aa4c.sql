
DROP POLICY IF EXISTS "Campanhas visíveis por empresa ou master" ON public.campanhas;
DROP POLICY IF EXISTS "Master ou gerencial podem editar campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Master ou gerencial podem excluir campanhas" ON public.campanhas;

CREATE POLICY "Campanhas visíveis por empresa ou master"
ON public.campanhas FOR SELECT
USING (
  public.has_role(auth.uid(), 'master')
  OR cod_empresa_bi IN (SELECT p.cod_empresa_bi FROM public.profiles p WHERE p.user_id = auth.uid())
);

CREATE POLICY "Master ou gerencial podem editar campanhas"
ON public.campanhas FOR UPDATE
USING (
  public.has_role(auth.uid(), 'master')
  OR (
    public.has_role(auth.uid(), 'gerencial')
    AND cod_empresa_bi IN (SELECT p.cod_empresa_bi FROM public.profiles p WHERE p.user_id = auth.uid())
  )
);

CREATE POLICY "Master ou gerencial podem excluir campanhas"
ON public.campanhas FOR DELETE
USING (
  public.has_role(auth.uid(), 'master')
  OR (
    public.has_role(auth.uid(), 'gerencial')
    AND cod_empresa_bi IN (SELECT p.cod_empresa_bi FROM public.profiles p WHERE p.user_id = auth.uid())
  )
);
