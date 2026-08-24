ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_agrupado TEXT,
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_clientes_analise TEXT;