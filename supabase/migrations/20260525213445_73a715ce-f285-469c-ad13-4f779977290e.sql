-- Create the enum for student origin
CREATE TYPE public.origem_aluno AS ENUM ('Google', 'Meta', 'Indicação', 'Outros');

-- Add new columns to the alunos table
ALTER TABLE public.alunos 
ADD COLUMN origem public.origem_aluno NOT NULL DEFAULT 'Google',
ADD COLUMN origem_detalhe TEXT,
ADD COLUMN vendedora TEXT NOT NULL DEFAULT 'Eduarda',
ADD COLUMN observacao TEXT;

-- Remove defaults after setting them for existing rows if any
ALTER TABLE public.alunos ALTER COLUMN origem DROP DEFAULT;
ALTER TABLE public.alunos ALTER COLUMN vendedora DROP DEFAULT;
