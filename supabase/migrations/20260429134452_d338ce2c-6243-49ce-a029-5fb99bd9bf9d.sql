ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS json_path_comercial_produtos text,
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_produtos text DEFAULT '/comercial/produtos';