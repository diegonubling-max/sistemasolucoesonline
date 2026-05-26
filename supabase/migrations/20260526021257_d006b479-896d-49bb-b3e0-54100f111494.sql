-- 1. Remover quaisquer triggers ou regras que possam estar causando comportamentos inesperados (limpeza preventiva)
-- Não encontramos triggers suspeitos, mas vamos reforçar as FKs.

-- 2. Reforçar restrição: Aluno -> Matrículas (Não permitir excluir aluno com matrícula)
ALTER TABLE public.matriculas 
DROP CONSTRAINT IF EXISTS matriculas_aluno_id_fkey,
ADD CONSTRAINT matriculas_aluno_id_fkey 
FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE RESTRICT;

-- 3. Reforçar restrição: Curso -> Matrícula_Cursos (Não permitir excluir curso com alunos matriculados)
ALTER TABLE public.matricula_cursos 
DROP CONSTRAINT IF EXISTS matricula_cursos_curso_id_fkey,
ADD CONSTRAINT matricula_cursos_curso_id_fkey 
FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE RESTRICT;

-- 4. Reforçar restrição: Curso -> Aulas (Não permitir excluir curso com aulas)
ALTER TABLE public.aulas 
DROP CONSTRAINT IF EXISTS aulas_curso_id_fkey,
ADD CONSTRAINT aulas_curso_id_fkey 
FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE RESTRICT;

-- 5. Garantir Cascades Seguros (apenas dados de perfil ou o vínculo da matrícula)
ALTER TABLE public.perfis_alunos 
DROP CONSTRAINT IF EXISTS perfis_alunos_aluno_id_fkey,
ADD CONSTRAINT perfis_alunos_aluno_id_fkey 
FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

ALTER TABLE public.matricula_cursos 
DROP CONSTRAINT IF EXISTS matricula_cursos_matricula_id_fkey,
ADD CONSTRAINT matricula_cursos_matricula_id_fkey 
FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;

ALTER TABLE public.matricula_pacotes 
DROP CONSTRAINT IF EXISTS matricula_pacotes_matricula_id_fkey,
ADD CONSTRAINT matricula_pacotes_matricula_id_fkey 
FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;