-- =========================================================
-- 1) estoque_assistant_config: restringir por empresa
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read config" ON public.estoque_assistant_config;
DROP POLICY IF EXISTS "Authenticated users can insert config" ON public.estoque_assistant_config;
DROP POLICY IF EXISTS "Authenticated users can update config" ON public.estoque_assistant_config;

CREATE POLICY "Read assistant config by company"
ON public.estoque_assistant_config
FOR SELECT
TO authenticated
USING (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa());

CREATE POLICY "Insert assistant config by company"
ON public.estoque_assistant_config
FOR INSERT
TO authenticated
WITH CHECK (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa());

CREATE POLICY "Update assistant config by company"
ON public.estoque_assistant_config
FOR UPDATE
TO authenticated
USING (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa())
WITH CHECK (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa());

-- =========================================================
-- 2) estoque_assistant_credits: restringir por empresa
--    (mesmo problema: USING true e WITH CHECK true)
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read credits" ON public.estoque_assistant_credits;
DROP POLICY IF EXISTS "Authenticated users can insert credits" ON public.estoque_assistant_credits;
DROP POLICY IF EXISTS "Authenticated users can update credits" ON public.estoque_assistant_credits;

CREATE POLICY "Read assistant credits by company"
ON public.estoque_assistant_credits
FOR SELECT
TO authenticated
USING (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa());

CREATE POLICY "Insert assistant credits by company"
ON public.estoque_assistant_credits
FOR INSERT
TO authenticated
WITH CHECK (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa());

CREATE POLICY "Update assistant credits by company"
ON public.estoque_assistant_credits
FOR UPDATE
TO authenticated
USING (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa())
WITH CHECK (public.is_master_user() OR cod_empresa_bi = public.get_user_empresa());

-- =========================================================
-- 3) user_roles: corrigir privilege escalation
--    Gerencial só pode gerenciar role 'vendedor' tanto em USING quanto WITH CHECK
-- =========================================================
DROP POLICY IF EXISTS "Masters and gerenciais can manage roles" ON public.user_roles;

CREATE POLICY "Masters and gerenciais can manage roles"
ON public.user_roles
FOR ALL
TO public
USING (
  public.is_master_user()
  OR (
    public.is_gerencial_user()
    AND role = 'vendedor'::public.app_role
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.cod_empresa_bi = public.get_user_empresa()
    )
  )
)
WITH CHECK (
  public.is_master_user()
  OR (
    public.is_gerencial_user()
    AND role = 'vendedor'::public.app_role
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.cod_empresa_bi = public.get_user_empresa()
    )
  )
);

-- =========================================================
-- 4) realtime.messages: restringir broadcast por empresa
--    Topics convencionados: <table>:<company_id> ou <table>:<id>
--    Como o app não usa um padrão estrito, exigimos que o usuário
--    esteja autenticado e tenha empresa associada. Combinado com as
--    RLS já existentes em whatsapp_*, isso evita vazamento (Realtime
--    aplica RLS ao SELECT subjacente em postgres_changes).
-- =========================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users with company can subscribe" ON realtime.messages;

CREATE POLICY "Authenticated users with company can subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_master_user()
  OR public.get_user_empresa() IS NOT NULL
);