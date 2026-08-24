
ALTER TABLE public.empresas 
  ADD COLUMN IF NOT EXISTS endpoint_path_dre TEXT DEFAULT '/financeiro/dre',
  ADD COLUMN IF NOT EXISTS endpoint_path_variacao TEXT DEFAULT '/financeiro/variacao',
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_pedidos TEXT DEFAULT '/comercial/pedidos',
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_devolucoes TEXT DEFAULT '/comercial/devolucoes';
