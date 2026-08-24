ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS json_path_duplicatas text,
  ADD COLUMN IF NOT EXISTS json_path_fluxo_caixa text,
  ADD COLUMN IF NOT EXISTS endpoint_path_duplicatas text,
  ADD COLUMN IF NOT EXISTS endpoint_path_fluxo_caixa text;