ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS json_path_fluxo_caixa_movimento text,
  ADD COLUMN IF NOT EXISTS endpoint_path_fluxo_caixa_movimento text;