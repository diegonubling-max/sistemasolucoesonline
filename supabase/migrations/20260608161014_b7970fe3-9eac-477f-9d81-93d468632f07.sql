-- Update polos table
ALTER TABLE public.polos ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.polos ADD COLUMN IF NOT EXISTS endereco TEXT;

-- Create declaracoes_matricula table
CREATE TABLE IF NOT EXISTS public.declaracoes_matricula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    gerado_por UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
    gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS and Permissions
ALTER TABLE public.declaracoes_matricula ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.declaracoes_matricula TO authenticated;
GRANT ALL ON public.declaracoes_matricula TO service_role;

CREATE POLICY "Colaboradores podem gerenciar declarações" 
ON public.declaracoes_matricula FOR ALL 
USING (true) 
WITH CHECK (true);
