-- Add profile photo column to alunos
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- Create storage bucket for profile photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-perfil', 'fotos-perfil', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
-- Allow public access to profile photos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'fotos-perfil');

-- Allow students to upload their own photo
CREATE POLICY "Students can upload their own photo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fotos-perfil' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);

-- Allow students to update their own photo
CREATE POLICY "Students can update their own photo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fotos-perfil' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);

-- Allow students to delete their own photo
CREATE POLICY "Students can delete their own photo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fotos-perfil' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);