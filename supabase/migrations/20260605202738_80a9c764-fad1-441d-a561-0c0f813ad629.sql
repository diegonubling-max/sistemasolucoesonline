-- Políticas para o bucket 'documentos'
CREATE POLICY "Acesso público aos documentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'documentos');

CREATE POLICY "Upload de documentos por usuários autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Exclusão de documentos por usuários autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documentos');
