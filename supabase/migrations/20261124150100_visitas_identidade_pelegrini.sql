-- Apenas identidade e permissões do portal. Os relatórios vivem no SQL Server interno.
CREATE OR REPLACE FUNCTION public.visitas_identidade()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', session_user_id.id,
    'nome', coalesce(nullif(btrim(p.nome), ''), p.email, 'Usuário Pelegrini'),
    'roles', coalesce((
      SELECT jsonb_agg(r.role)
      FROM public.user_roles r
      WHERE r.user_id = session_user_id.id
    ), '[]'::jsonb),
    'empresa', p.cod_empresa_bi,
    'filial_padrao', p.filial_id,
    'filiais', p.filiais_permitidas,
    'comercial', coalesce(permissions.modulo_comercial, false) AND p.cod_empresa_bi IN ('1004', '10041') AND coalesce(
      (SELECT company.modulo_comercial FROM public.empresas company WHERE company.cod_empresa_bi = p.cod_empresa_bi),
      true
    ),
    'must_change_password', coalesce(p.must_change_password, false)
  )
  FROM (SELECT auth.uid() AS id) session_user_id
  LEFT JOIN public.profiles p ON p.user_id = session_user_id.id
  LEFT JOIN public.user_module_permissions permissions ON permissions.user_id = session_user_id.id
  WHERE session_user_id.id IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.visitas_identidade() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visitas_identidade() TO authenticated;

-- Mantém a administração de vendedores da própria empresa, inclusive para o cadastro existente.
CREATE OR REPLACE FUNCTION public.gerencia_administrar_vendedor(target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_gerencial_user()
    AND target_id <> auth.uid()
    AND public.has_role(target_id, 'vendedor')
    AND NOT public.has_role(target_id, 'master')
    AND NOT public.has_role(target_id, 'gerencial')
    AND NOT public.has_role(target_id, 'visitador')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = target_id AND p.cod_empresa_bi = public.get_user_empresa()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.gerencia_administrar_vendedor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerencia_administrar_vendedor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.proteger_escopo_do_perfil()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_master_user() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.cod_empresa_bi, NEW.filial_id, NEW.filiais_permitidas)
        IS NOT DISTINCT FROM (OLD.cod_empresa_bi, OLD.filial_id, OLD.filiais_permitidas) THEN
      RETURN NEW;
    END IF;
    IF NEW.cod_empresa_bi = OLD.cod_empresa_bi AND public.gerencia_administrar_vendedor(OLD.user_id) THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.cod_empresa_bi IS NULL AND NEW.filial_id IS NULL
      AND coalesce(cardinality(NEW.filiais_permitidas), 0) = 0 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A empresa e as filiais são administradas pelo Pelegrini.' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER proteger_escopo_do_perfil
BEFORE INSERT OR UPDATE OF cod_empresa_bi, filial_id, filiais_permitidas ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.proteger_escopo_do_perfil();

DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
CREATE POLICY "Users can update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_master_user() OR public.gerencia_administrar_vendedor(user_id))
WITH CHECK (user_id = auth.uid() OR public.is_master_user() OR public.gerencia_administrar_vendedor(user_id));

DROP POLICY IF EXISTS "Gerenciais can manage own company permissions" ON public.user_module_permissions;
CREATE POLICY "Gerenciais can view own company permissions" ON public.user_module_permissions
FOR SELECT TO authenticated
USING (public.is_gerencial_user() AND EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = user_module_permissions.user_id AND p.cod_empresa_bi = public.get_user_empresa()
));
CREATE POLICY "Gerenciais can manage vendedor permissions" ON public.user_module_permissions
FOR ALL TO authenticated
USING (public.gerencia_administrar_vendedor(user_id))
WITH CHECK (public.gerencia_administrar_vendedor(user_id));
