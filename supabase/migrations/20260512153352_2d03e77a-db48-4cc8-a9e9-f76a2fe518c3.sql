
-- 1. whatsapp_instance_secrets: restringir SELECT a master/gerencial
DROP POLICY IF EXISTS "Masters and gerenciais can view instance secrets" ON public.whatsapp_instance_secrets;
DROP POLICY IF EXISTS "Masters can manage instance secrets" ON public.whatsapp_instance_secrets;

CREATE POLICY "Masters can manage instance secrets"
ON public.whatsapp_instance_secrets
FOR ALL
TO authenticated
USING (
  is_master_user() AND EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi
    WHERE wi.id = whatsapp_instance_secrets.instance_id
      AND can_access_company(wi.company_id)
  )
)
WITH CHECK (
  is_master_user() AND EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi
    WHERE wi.id = whatsapp_instance_secrets.instance_id
      AND can_access_company(wi.company_id)
  )
);

CREATE POLICY "Gerenciais can view instance secrets of own company"
ON public.whatsapp_instance_secrets
FOR SELECT
TO authenticated
USING (
  is_gerencial_user() AND EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi
    WHERE wi.id = whatsapp_instance_secrets.instance_id
      AND can_access_company(wi.company_id)
  )
);

-- 2. profiles: restringir todas as policies a authenticated
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Masters and gerenciais can insert profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_master_user()
  OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa())
);

CREATE POLICY "Users can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR is_master_user()
  OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa())
)
WITH CHECK (
  user_id = auth.uid()
  OR is_master_user()
  OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa())
);

CREATE POLICY "Masters and gerenciais can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  is_master_user()
  OR user_id = auth.uid()
  OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa())
);

-- 3. seller_whitelist: restringir a authenticated
DROP POLICY IF EXISTS "Masters can manage whitelist" ON public.seller_whitelist;
DROP POLICY IF EXISTS "Gerenciais can manage own company whitelist" ON public.seller_whitelist;

CREATE POLICY "Masters can manage whitelist"
ON public.seller_whitelist
FOR ALL
TO authenticated
USING (is_master_user())
WITH CHECK (is_master_user());

CREATE POLICY "Gerenciais can manage own company whitelist"
ON public.seller_whitelist
FOR ALL
TO authenticated
USING (
  is_gerencial_user() AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = seller_whitelist.company_id
      AND e.cod_empresa_bi = get_user_empresa()
  )
)
WITH CHECK (
  is_gerencial_user() AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = seller_whitelist.company_id
      AND e.cod_empresa_bi = get_user_empresa()
  )
);

-- 4. realtime.messages: escopar subscrições por empresa do usuário no topic
DROP POLICY IF EXISTS "Authenticated users with company can subscribe" ON realtime.messages;

CREATE POLICY "Authenticated users can subscribe to own company channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  is_master_user()
  OR (
    get_user_empresa() IS NOT NULL
    AND (
      realtime.topic() = get_user_empresa()
      OR realtime.topic() LIKE get_user_empresa() || ':%'
      OR realtime.topic() LIKE get_user_empresa() || '-%'
      OR realtime.topic() LIKE '%:' || get_user_empresa()
      OR realtime.topic() LIKE '%:' || get_user_empresa() || ':%'
    )
  )
);
