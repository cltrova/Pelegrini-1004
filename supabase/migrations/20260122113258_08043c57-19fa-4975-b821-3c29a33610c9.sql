-- Add phone_e164 and default_seller_id to whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS default_seller_id UUID REFERENCES public.profiles(id);

-- Index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_phone_e164 
ON public.whatsapp_instances(phone_e164);

-- Comments for documentation
COMMENT ON COLUMN public.whatsapp_instances.phone_e164 IS 
  'Número do WhatsApp conectado em formato E.164 (+5519999999999)';

COMMENT ON COLUMN public.whatsapp_instances.default_seller_id IS 
  'Vendedor responsável pela instância, cadastrado automaticamente pelo número conectado';