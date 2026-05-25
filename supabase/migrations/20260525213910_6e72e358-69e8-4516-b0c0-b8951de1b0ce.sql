-- Create the enum for student gender
CREATE TYPE public.sexo_aluno AS ENUM ('Masculino', 'Feminino');

-- Add the sexo column to the alunos table
-- We use a temporary default to update existing rows, then remove it
ALTER TABLE public.alunos 
ADD COLUMN sexo public.sexo_aluno NOT NULL DEFAULT 'Feminino';

-- Remove the default
ALTER TABLE public.alunos ALTER COLUMN sexo DROP DEFAULT;
