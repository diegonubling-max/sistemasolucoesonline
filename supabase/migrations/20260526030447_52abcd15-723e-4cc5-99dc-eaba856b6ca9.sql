-- Alterar a restrição de chave estrangeira para evitar exclusão em cascata
ALTER TABLE public.matriculas 
DROP CONSTRAINT IF EXISTS matriculas_aluno_id_fkey,
ADD CONSTRAINT matriculas_aluno_id_fkey 
  FOREIGN KEY (aluno_id) 
  REFERENCES public.alunos(id) 
  ON DELETE RESTRICT;