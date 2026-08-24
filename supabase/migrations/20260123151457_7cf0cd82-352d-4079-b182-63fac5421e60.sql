-- Criar função update_updated_at_column se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar tabela de permissões de módulos por usuário
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    modulo_dre BOOLEAN NOT NULL DEFAULT false,
    modulo_variacao BOOLEAN NOT NULL DEFAULT false,
    modulo_comercial BOOLEAN NOT NULL DEFAULT false,
    modulo_assistente_ia BOOLEAN NOT NULL DEFAULT false,
    modulo_whatsapp BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Masters podem gerenciar todas as permissões
CREATE POLICY "Masters can manage all permissions"
ON public.user_module_permissions
FOR ALL
USING (is_master_user())
WITH CHECK (is_master_user());

-- Gerenciais podem gerenciar permissões de usuários da mesma empresa
CREATE POLICY "Gerenciais can manage own company permissions"
ON public.user_module_permissions
FOR ALL
USING (
    is_gerencial_user() AND (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = user_module_permissions.user_id
            AND p.cod_empresa_bi = get_user_empresa()
        )
    )
)
WITH CHECK (
    is_gerencial_user() AND (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = user_module_permissions.user_id
            AND p.cod_empresa_bi = get_user_empresa()
        )
    )
);

-- Usuários podem ver suas próprias permissões
CREATE POLICY "Users can view own permissions"
ON public.user_module_permissions
FOR SELECT
USING (user_id = auth.uid() OR is_master_user());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_module_permissions_updated_at
BEFORE UPDATE ON public.user_module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar permissões padrão para usuários existentes (herdam da empresa)
INSERT INTO public.user_module_permissions (user_id, modulo_dre, modulo_variacao, modulo_comercial, modulo_assistente_ia, modulo_whatsapp)
SELECT 
    p.user_id,
    COALESCE(e.modulo_dre, false),
    COALESCE(e.modulo_variacao, false),
    COALESCE(e.modulo_comercial, false),
    COALESCE(e.modulo_assistente_ia, false),
    COALESCE(e.modulo_whatsapp, false)
FROM profiles p
LEFT JOIN empresas e ON e.cod_empresa_bi = p.cod_empresa_bi
WHERE NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump WHERE ump.user_id = p.user_id
)
ON CONFLICT (user_id) DO NOTHING;