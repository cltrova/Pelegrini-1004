
-- Add operacional module flag and estoque endpoint/json paths to empresas
ALTER TABLE public.empresas
  ADD COLUMN modulo_operacional boolean DEFAULT false,
  ADD COLUMN endpoint_path_estoque_giro text DEFAULT NULL,
  ADD COLUMN endpoint_path_estoque_consolidado text DEFAULT NULL,
  ADD COLUMN endpoint_path_estoque_detalhado text DEFAULT NULL,
  ADD COLUMN json_path_estoque_giro text DEFAULT NULL,
  ADD COLUMN json_path_estoque_consolidado text DEFAULT NULL,
  ADD COLUMN json_path_estoque_detalhado text DEFAULT NULL;

-- Add operacional permission to user_module_permissions
ALTER TABLE public.user_module_permissions
  ADD COLUMN modulo_operacional boolean NOT NULL DEFAULT false;
