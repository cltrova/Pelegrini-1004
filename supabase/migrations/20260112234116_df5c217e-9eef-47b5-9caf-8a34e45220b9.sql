-- Adicionar campos para caminhos de JSON por módulo na tabela empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS json_path_dre TEXT,
ADD COLUMN IF NOT EXISTS json_path_variacao TEXT,
ADD COLUMN IF NOT EXISTS json_path_comercial TEXT;

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.empresas.json_path_dre IS 'Caminho do arquivo JSON local para módulo DRE (alternativa ao endpoint)';
COMMENT ON COLUMN public.empresas.json_path_variacao IS 'Caminho do arquivo JSON local para módulo Variação (alternativa ao endpoint)';
COMMENT ON COLUMN public.empresas.json_path_comercial IS 'Caminho do arquivo JSON local para módulo Comercial (alternativa ao endpoint)';