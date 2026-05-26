-- Adicionar colunas de thumbnail
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Criar buckets de storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('thumbnails-cursos', 'thumbnails-cursos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('thumbnails-aulas', 'thumbnails-aulas', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para thumbnails-cursos
CREATE POLICY "Thumbnails de cursos são públicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'thumbnails-cursos');

CREATE POLICY "Admin pode inserir thumbnails de cursos" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'thumbnails-cursos');

CREATE POLICY "Admin pode atualizar thumbnails de cursos" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'thumbnails-cursos');

CREATE POLICY "Admin pode deletar thumbnails de cursos" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'thumbnails-cursos');

-- Políticas de acesso para thumbnails-aulas
CREATE POLICY "Thumbnails de aulas são públicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'thumbnails-aulas');

CREATE POLICY "Admin pode inserir thumbnails de aulas" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'thumbnails-aulas');

CREATE POLICY "Admin pode atualizar thumbnails de aulas" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'thumbnails-aulas');

CREATE POLICY "Admin pode deletar thumbnails de aulas" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'thumbnails-aulas');