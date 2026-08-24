-- Criar bucket para armazenar arquivos JSON de dados
INSERT INTO storage.buckets (id, name, public)
VALUES ('dados-json', 'dados-json', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso - apenas masters podem gerenciar
CREATE POLICY "Masters can upload JSON files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'dados-json' 
  AND public.is_master_user()
);

CREATE POLICY "Masters can view JSON files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'dados-json' 
  AND public.is_master_user()
);

CREATE POLICY "Masters can update JSON files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'dados-json' 
  AND public.is_master_user()
);

CREATE POLICY "Masters can delete JSON files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'dados-json' 
  AND public.is_master_user()
);