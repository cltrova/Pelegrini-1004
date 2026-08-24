-- Criar tabela de empresas com configuração de módulos
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi text UNIQUE NOT NULL,
  nome text NOT NULL,
  endpoint_url text NOT NULL,
  modulo_dre boolean DEFAULT false,
  modulo_variacao boolean DEFAULT false,
  modulo_comercial boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Masters podem gerenciar todas as empresas
CREATE POLICY "Masters can manage empresas" ON public.empresas
  FOR ALL USING (is_master_user()) WITH CHECK (is_master_user());

-- Usuários podem visualizar sua própria empresa
CREATE POLICY "Users can view their empresa" ON public.empresas
  FOR SELECT USING (
    cod_empresa_bi = get_user_empresa() 
    OR is_master_user()
  );

-- Trigger para updated_at
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();