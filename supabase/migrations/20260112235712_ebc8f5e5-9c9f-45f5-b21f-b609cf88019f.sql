-- Adicionar coluna para módulo Assistente IA
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS modulo_assistente_ia boolean DEFAULT false;