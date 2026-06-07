-- Adiciona coluna de polo em tabelas que ainda não possuem (se necessário)
-- A tabela alunos e colaboradores já possuem polo_id conforme os types.
-- Vamos garantir que matriculas e parcelas também tenham para facilitar a filtragem direta.

ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS polo_id UUID REFERENCES public.polos(id);
ALTER TABLE public.parcelas ADD COLUMN IF NOT EXISTS polo_id UUID REFERENCES public.polos(id);

-- Atualiza polo_id em matriculas e parcelas baseado no aluno
UPDATE public.matriculas m SET polo_id = a.polo_id FROM public.alunos a WHERE m.aluno_id = a.id AND m.polo_id IS NULL;
UPDATE public.parcelas p SET polo_id = m.polo_id FROM public.matriculas m WHERE p.matricula_id = m.id AND p.polo_id IS NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_alunos_polo_id ON public.alunos(polo_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_polo_id ON public.matriculas(polo_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_polo_id ON public.parcelas(polo_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_polo_id ON public.colaboradores(polo_id);

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matriculas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcelas TO authenticated;
GRANT ALL ON public.matriculas TO service_role;
GRANT ALL ON public.parcelas TO service_role;
