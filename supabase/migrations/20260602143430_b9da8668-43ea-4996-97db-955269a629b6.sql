ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS usar_vps_intermediaria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vps_base_url text DEFAULT 'http://187.77.203.16',
  ADD COLUMN IF NOT EXISTS vps_cliente_identificador text;