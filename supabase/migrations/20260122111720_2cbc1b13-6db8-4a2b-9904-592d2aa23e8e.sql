-- Corrigir search_path da função normalize_phone_e164
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  clean_phone TEXT;
BEGIN
  -- Remove tudo que não é número
  clean_phone := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Se começar com 55 e tiver 12-13 dígitos, já está correto
  IF clean_phone LIKE '55%' AND length(clean_phone) BETWEEN 12 AND 13 THEN
    RETURN '+' || clean_phone;
  END IF;
  
  -- Se tiver 10-11 dígitos (DDD + número), adicionar +55
  IF length(clean_phone) BETWEEN 10 AND 11 THEN
    RETURN '+55' || clean_phone;
  END IF;
  
  -- Retornar como está (com +) se não se encaixar nos padrões
  IF clean_phone != '' THEN
    RETURN '+' || clean_phone;
  END IF;
  
  RETURN NULL;
END;
$$;