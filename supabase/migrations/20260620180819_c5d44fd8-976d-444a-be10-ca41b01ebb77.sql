CREATE TABLE IF NOT EXISTS public.aluno_perfil_vocacional (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE UNIQUE,
  respostas jsonb NOT NULL,
  perfil_identificado text,
  segmentos_recomendados text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_perfil_vocacional TO authenticated;
GRANT ALL ON public.aluno_perfil_vocacional TO service_role;

ALTER TABLE public.aluno_perfil_vocacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno gerencia seu proprio perfil vocacional"
ON public.aluno_perfil_vocacional
FOR ALL
TO authenticated
USING (
  aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Colaboradores podem ver perfis vocacionais"
ON public.aluno_perfil_vocacional
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.colaboradores WHERE user_id = auth.uid()));

CREATE TRIGGER update_aluno_perfil_vocacional_updated_at
BEFORE UPDATE ON public.aluno_perfil_vocacional
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();