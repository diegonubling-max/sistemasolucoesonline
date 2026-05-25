-- Remove address columns from the alunos table
ALTER TABLE public.alunos 
DROP COLUMN IF EXISTS endereco,
DROP COLUMN IF EXISTS bairro,
DROP COLUMN IF EXISTS cidade,
DROP COLUMN IF EXISTS estado;
