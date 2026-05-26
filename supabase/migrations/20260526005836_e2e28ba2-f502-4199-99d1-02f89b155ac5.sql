-- Create sequence for CTR starting at 1627
CREATE SEQUENCE IF NOT EXISTS public.alunos_ctr_seq START WITH 1627;

-- Add ctr column to alunos table
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS ctr INTEGER UNIQUE NOT NULL DEFAULT nextval('public.alunos_ctr_seq');

-- Ensure the column is not editable via typical updates if possible (though we handle this in UI)
-- But for now, just adding the column is the priority.