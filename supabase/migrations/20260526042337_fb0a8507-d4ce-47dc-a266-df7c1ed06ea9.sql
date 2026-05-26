-- Permitir valores nulos para email e vendedora na tabela de alunos
ALTER TABLE public.alunos ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.alunos ALTER COLUMN vendedora DROP NOT NULL;