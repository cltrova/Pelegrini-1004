-- Função para verificar se usuário é gerencial
CREATE OR REPLACE FUNCTION public.is_gerencial_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'gerencial')
$$;

-- Função para verificar se usuário é vendedor
CREATE OR REPLACE FUNCTION public.is_vendedor_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'vendedor')
$$;

-- Função para verificar se pode gerenciar usuários (master ou gerencial da mesma empresa)
CREATE OR REPLACE FUNCTION public.can_manage_users_in_company(target_company_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_master_user() 
    OR (
      public.is_gerencial_user() 
      AND public.get_user_empresa() = target_company_code
    )
$$;

-- Atualizar RLS para profiles: gerenciais podem ver usuários da mesma empresa
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_master_user()
  OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa())
);

-- Gerenciais podem criar usuários na própria empresa
DROP POLICY IF EXISTS "Masters can insert profiles" ON public.profiles;
CREATE POLICY "Masters and gerenciais can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  is_master_user() 
  OR (user_id = auth.uid())
  OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa())
);

-- Gerenciais podem atualizar perfis da própria empresa (apenas vendedores)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update profiles"
ON public.profiles
FOR UPDATE
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

-- Atualizar RLS para user_roles: gerenciais podem gerenciar roles de vendedores da empresa
DROP POLICY IF EXISTS "Masters can manage roles" ON public.user_roles;
CREATE POLICY "Masters and gerenciais can manage roles"
ON public.user_roles
FOR ALL
USING (
  is_master_user() 
  OR (
    is_gerencial_user() 
    AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = user_roles.user_id 
      AND p.cod_empresa_bi = get_user_empresa()
    )
  )
)
WITH CHECK (
  is_master_user() 
  OR (
    is_gerencial_user() 
    AND role = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = user_roles.user_id 
      AND p.cod_empresa_bi = get_user_empresa()
    )
  )
);

-- Atualizar RLS para whatsapp_conversations: vendedores só veem suas próprias conversas
DROP POLICY IF EXISTS "Users can view conversations of their company" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can manage conversations of their company" ON public.whatsapp_conversations;

CREATE POLICY "View conversations by role"
ON public.whatsapp_conversations
FOR SELECT
USING (
  can_access_company(company_id)
  AND (
    is_master_user()
    OR is_gerencial_user()
    OR (is_vendedor_user() AND assigned_to = auth.uid())
  )
);

CREATE POLICY "Manage conversations by role"
ON public.whatsapp_conversations
FOR ALL
USING (
  can_access_company(company_id)
  AND (
    is_master_user()
    OR is_gerencial_user()
    OR (is_vendedor_user() AND assigned_to = auth.uid())
  )
)
WITH CHECK (
  can_access_company(company_id)
  AND (
    is_master_user()
    OR is_gerencial_user()
    OR (is_vendedor_user() AND assigned_to = auth.uid())
  )
);

-- Atualizar RLS para whatsapp_messages: vendedores só veem mensagens das próprias conversas
DROP POLICY IF EXISTS "Users can view messages of their company" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can manage messages of their company" ON public.whatsapp_messages;

CREATE POLICY "View messages by role"
ON public.whatsapp_messages
FOR SELECT
USING (
  can_access_company(company_id)
  AND (
    is_master_user()
    OR is_gerencial_user()
    OR (
      is_vendedor_user() 
      AND EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c 
        WHERE c.id = whatsapp_messages.conversation_id 
        AND c.assigned_to = auth.uid()
      )
    )
  )
);

CREATE POLICY "Manage messages by role"
ON public.whatsapp_messages
FOR ALL
USING (
  can_access_company(company_id)
  AND (
    is_master_user()
    OR is_gerencial_user()
    OR (
      is_vendedor_user() 
      AND EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c 
        WHERE c.id = whatsapp_messages.conversation_id 
        AND c.assigned_to = auth.uid()
      )
    )
  )
)
WITH CHECK (
  can_access_company(company_id)
  AND (
    is_master_user()
    OR is_gerencial_user()
    OR (
      is_vendedor_user() 
      AND EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c 
        WHERE c.id = whatsapp_messages.conversation_id 
        AND c.assigned_to = auth.uid()
      )
    )
  )
);