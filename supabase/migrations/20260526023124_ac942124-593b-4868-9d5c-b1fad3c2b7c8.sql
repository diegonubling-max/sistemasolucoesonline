-- Primeiro, removemos as constraints existentes que podem estar causando problemas ou que precisam ser atualizadas
ALTER TABLE IF EXISTS public.matriculas DROP CONSTRAINT IF EXISTS matriculas_aluno_id_fkey;
ALTER TABLE IF EXISTS public.matricula_cursos DROP CONSTRAINT IF EXISTS matricula_cursos_matricula_id_fkey;
ALTER TABLE IF EXISTS public.matricula_cursos DROP CONSTRAINT IF EXISTS matricula_cursos_curso_id_fkey;
ALTER TABLE IF EXISTS public.matricula_pacotes DROP CONSTRAINT IF EXISTS matricula_pacotes_matricula_id_fkey;
ALTER TABLE IF EXISTS public.matricula_pacotes DROP CONSTRAINT IF EXISTS matricula_pacotes_pacote_id_fkey;
ALTER TABLE IF EXISTS public.aulas DROP CONSTRAINT IF EXISTS aulas_curso_id_fkey;

-- 1. Excluir aluno -> apaga somente as matriculas desse aluno (CASCADE)
ALTER TABLE public.matriculas
ADD CONSTRAINT matriculas_aluno_id_fkey
FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- 2. Excluir matrícula -> apaga somente os registros em matricula_cursos (CASCADE)
ALTER TABLE public.matricula_cursos
ADD CONSTRAINT matricula_cursos_matricula_id_fkey
FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;

-- 3. Excluir matrícula -> apaga somente os registros em matricula_pacotes (CASCADE)
ALTER TABLE public.matricula_pacotes
ADD CONSTRAINT matricula_pacotes_matricula_id_fkey
FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;

-- 4. Proteção: NUNCA apagar cursos ao excluir vínculo (RESTRICT)
ALTER TABLE public.matricula_cursos
ADD CONSTRAINT matricula_cursos_curso_id_fkey
FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE RESTRICT;

-- 5. Proteção: NUNCA apagar pacotes ao excluir vínculo (RESTRICT)
ALTER TABLE public.matricula_pacotes
ADD CONSTRAINT matricula_pacotes_pacote_id_fkey
FOREIGN KEY (pacote_id) REFERENCES public.pacotes(id) ON DELETE RESTRICT;

-- 6. Proteção: NUNCA apagar curso se houver aulas (RESTRICT)
ALTER TABLE public.aulas
ADD CONSTRAINT aulas_curso_id_fkey
FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE RESTRICT;
