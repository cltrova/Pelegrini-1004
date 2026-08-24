
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_pedidos_ch text,
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_devolucoes_ch text,
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_produtos_ch text,
  ADD COLUMN IF NOT EXISTS json_path_comercial_ch text,
  ADD COLUMN IF NOT EXISTS json_path_comercial_produtos_ch text;
