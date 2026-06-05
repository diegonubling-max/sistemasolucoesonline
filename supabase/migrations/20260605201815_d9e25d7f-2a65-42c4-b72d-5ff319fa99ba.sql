CREATE TABLE public.aluno_sessoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    login_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    logout_em TIMESTAMP WITH TIME ZONE,
    duracao_minutos INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.aluno_aulas_assistidas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    aula_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
    curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    assistida_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_sessoes TO authenticated;
GRANT ALL ON public.aluno_sessoes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_aulas_assistidas TO authenticated;
GRANT ALL ON public.aluno_aulas_assistidas TO service_role;

-- RLS
ALTER TABLE public.aluno_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_aulas_assistidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alunos podem gerenciar suas próprias sessões" 
ON public.aluno_sessoes FOR ALL 
USING (aluno_id IN (SELECT id FROM public.alunos WHERE email = auth.jwt()->>'email'))
WITH CHECK (aluno_id IN (SELECT id FROM public.alunos WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Admins podem ver todas as sessões" 
ON public.aluno_sessoes FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Alunos podem gerenciar suas aulas assistidas" 
ON public.aluno_aulas_assistidas FOR ALL 
USING (aluno_id IN (SELECT id FROM public.alunos WHERE email = auth.jwt()->>'email'))
WITH CHECK (aluno_id IN (SELECT id FROM public.alunos WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Admins podem ver todas as aulas assistidas" 
ON public.aluno_aulas_assistidas FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
