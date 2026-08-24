ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_totais text,
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_pedidos_total text,
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_devolucoes_total text,
  ADD COLUMN IF NOT EXISTS endpoint_path_comercial_produtos_total text;

UPDATE public.empresas
SET
  endpoint_path_comercial_totais = COALESCE(endpoint_path_comercial_totais, '/comercial/totais'),
  endpoint_path_comercial_pedidos_total = COALESCE(endpoint_path_comercial_pedidos_total, '/comercial/pedidos/total'),
  endpoint_path_comercial_devolucoes_total = COALESCE(endpoint_path_comercial_devolucoes_total, '/comercial/devolucoes/total'),
  endpoint_path_comercial_produtos_total = COALESCE(endpoint_path_comercial_produtos_total, '/comercial/produtos/total')
WHERE cod_empresa_bi = '1003';