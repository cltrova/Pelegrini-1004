-- Adicionar campos de telefone e status na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Índice para busca rápida por telefone
CREATE INDEX IF NOT EXISTS idx_profiles_phone_e164 ON public.profiles(phone_e164);

-- Criar tabela seller_whitelist
CREATE TABLE IF NOT EXISTS public.seller_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  
  UNIQUE(company_id, phone_e164)
);

-- Habilitar RLS
ALTER TABLE public.seller_whitelist ENABLE ROW LEVEL SECURITY;

-- Policy: Masters podem tudo
CREATE POLICY "Masters can manage whitelist" ON public.seller_whitelist
FOR ALL USING (is_master_user())
WITH CHECK (is_master_user());

-- Policy: Gerenciais podem gerenciar da própria empresa
CREATE POLICY "Gerenciais can manage own company whitelist" ON public.seller_whitelist
FOR ALL USING (
  is_gerencial_user() AND EXISTS (
    SELECT 1 FROM public.empresas e 
    WHERE e.id = company_id 
    AND e.cod_empresa_bi = get_user_empresa()
  )
)
WITH CHECK (
  is_gerencial_user() AND EXISTS (
    SELECT 1 FROM public.empresas e 
    WHERE e.id = company_id 
    AND e.cod_empresa_bi = get_user_empresa()
  )
);

-- Função para normalizar telefone para E.164
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_phone TEXT;
BEGIN
  -- Remove tudo que não é número
  clean_phone := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Se começar com 55 e tiver 12-13 dígitos, já está correto
  IF clean_phone LIKE '55%' AND length(clean_phone) BETWEEN 12 AND 13 THEN
    RETURN '+' || clean_phone;
  END IF;
  
  -- Se tiver 10-11 dígitos (DDD + número), adicionar +55
  IF length(clean_phone) BETWEEN 10 AND 11 THEN
    RETURN '+55' || clean_phone;
  END IF;
  
  -- Retornar como está (com +) se não se encaixar nos padrões
  IF clean_phone != '' THEN
    RETURN '+' || clean_phone;
  END IF;
  
  RETURN NULL;
END;
$$;