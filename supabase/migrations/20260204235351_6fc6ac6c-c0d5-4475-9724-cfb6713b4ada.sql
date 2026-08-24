-- Adicionar flag para controle de layout comercial
ALTER TABLE empresas 
ADD COLUMN possui_meta_vendedor BOOLEAN DEFAULT true;

COMMENT ON COLUMN empresas.possui_meta_vendedor IS 
  'Define se a empresa utiliza o sistema de metas por vendedor. TRUE = layout com metas (padrão), FALSE = layout alternativo (ranking por faturamento)';