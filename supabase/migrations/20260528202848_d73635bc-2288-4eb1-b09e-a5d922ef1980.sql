CREATE TABLE IF NOT EXISTS public.cursos_vitrine (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id uuid REFERENCES public.alunos(id) 
    ON DELETE CASCADE,
  curso_id uuid REFERENCES public.cursos(id) 
    ON DELETE CASCADE,
  preco_pix numeric DEFAULT 0,
  preco_cartao numeric DEFAULT 0,
  max_parcelas integer DEFAULT 12,
  ativo boolean DEFAULT true,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

-- Use GRANT to set permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos_vitrine TO authenticated;
GRANT ALL ON public.cursos_vitrine TO service_role;

-- Enable Row Level Security
ALTER TABLE public.cursos_vitrine ENABLE ROW LEVEL SECURITY;

-- Create policies for showcase
CREATE POLICY "Admins can manage showcase" 
ON public.cursos_vitrine 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Students can view their own showcase" 
ON public.cursos_vitrine 
FOR SELECT 
USING (auth.uid() = aluno_id);
