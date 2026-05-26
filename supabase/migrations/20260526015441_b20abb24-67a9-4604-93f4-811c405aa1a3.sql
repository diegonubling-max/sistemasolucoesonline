-- 1. Reforçar restrições de exclusão para proteger os dados
-- Impedir exclusão de aluno se houver matrículas (RESTRICT)
ALTER TABLE public.matriculas 
DROP CONSTRAINT IF EXISTS matriculas_aluno_id_fkey,
ADD CONSTRAINT matriculas_aluno_id_fkey 
FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE RESTRICT;

-- Impedir exclusão de curso se houver aulas (RESTRICT)
ALTER TABLE public.aulas 
DROP CONSTRAINT IF EXISTS aulas_curso_id_fkey,
ADD CONSTRAINT aulas_curso_id_fkey 
FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE RESTRICT;

-- A relação matricula_cursos -> cursos já é RESTRICT, mas vamos garantir
ALTER TABLE public.matricula_cursos 
DROP CONSTRAINT IF EXISTS matricula_cursos_curso_id_fkey,
ADD CONSTRAINT matricula_cursos_curso_id_fkey 
FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE RESTRICT;

-- 2. Resolver erro de salvamento (RLS) e permissões
-- Permitir que o primeiro usuário se torne admin se a tabela estiver vazia
CREATE POLICY "Allow first user to become admin" ON public.user_roles
FOR INSERT WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  AND role = 'admin'
);

-- Atualizar políticas de administrador para serem mais explícitas com WITH CHECK
ALTER POLICY "Admins full access" ON public.cursos WITH CHECK (is_admin());
ALTER POLICY "Admins full access" ON public.alunos WITH CHECK (is_admin());
ALTER POLICY "Admins full access" ON public.aulas WITH CHECK (is_admin());
ALTER POLICY "Admins full access" ON public.matriculas WITH CHECK (is_admin());
ALTER POLICY "Admins full access" ON public.matricula_cursos WITH CHECK (is_admin());
ALTER POLICY "Admins full access" ON public.pacotes WITH CHECK (is_admin());
ALTER POLICY "Admins full access" ON public.matricula_pacotes WITH CHECK (is_admin());
ALTER POLICY "Admins full access" ON public.perfis_alunos WITH CHECK (is_admin());
