ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS cadastrado_por text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS cadastrado_por_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;