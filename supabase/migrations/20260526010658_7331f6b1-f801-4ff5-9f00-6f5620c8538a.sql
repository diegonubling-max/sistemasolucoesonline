-- Ensure matriculas are deleted when alumno is deleted
ALTER TABLE public.matriculas 
DROP CONSTRAINT IF EXISTS matriculas_aluno_id_fkey,
ADD CONSTRAINT matriculas_aluno_id_fkey 
  FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) 
  ON DELETE CASCADE;

-- Ensure matricula_cursos are deleted when matricula is deleted
ALTER TABLE public.matricula_cursos 
DROP CONSTRAINT IF EXISTS matricula_cursos_matricula_id_fkey,
ADD CONSTRAINT matricula_cursos_matricula_id_fkey 
  FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) 
  ON DELETE CASCADE;

-- Ensure matricula_pacotes are deleted when matricula is deleted
ALTER TABLE public.matricula_pacotes 
DROP CONSTRAINT IF EXISTS matricula_pacotes_matricula_id_fkey,
ADD CONSTRAINT matricula_pacotes_matricula_id_fkey 
  FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) 
  ON DELETE CASCADE;

-- Protect courses from being deleted if they have enrollments (optional but safer)
ALTER TABLE public.matricula_cursos 
DROP CONSTRAINT IF EXISTS matricula_cursos_curso_id_fkey,
ADD CONSTRAINT matricula_cursos_curso_id_fkey 
  FOREIGN KEY (curso_id) REFERENCES public.cursos(id) 
  ON DELETE RESTRICT;

-- Protect packages from being deleted if they have enrollments
ALTER TABLE public.matricula_pacotes 
DROP CONSTRAINT IF EXISTS matricula_pacotes_pacote_id_fkey,
ADD CONSTRAINT matricula_pacotes_pacote_id_fkey 
  FOREIGN KEY (pacote_id) REFERENCES public.pacotes(id) 
  ON DELETE RESTRICT;
