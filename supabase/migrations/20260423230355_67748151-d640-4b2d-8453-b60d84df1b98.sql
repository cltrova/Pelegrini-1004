ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS modulo_resumo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS json_path_resumo text,
  ADD COLUMN IF NOT EXISTS endpoint_path_resumo text;

ALTER TABLE public.user_module_permissions
  ADD COLUMN IF NOT EXISTS modulo_resumo boolean NOT NULL DEFAULT false;