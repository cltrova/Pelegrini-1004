-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Masters can view JSON files" ON storage.objects;

-- Create new policy: Users can read JSON files from their own company
CREATE POLICY "Users can read own company JSON files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'dados-json' 
  AND auth.role() = 'authenticated'
  AND (
    -- Masters can see all files
    public.is_master_user()
    OR
    -- Users can see files that start with their cod_empresa_bi
    name LIKE (public.get_user_empresa() || '/%')
  )
);