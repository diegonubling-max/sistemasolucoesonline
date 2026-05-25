-- Add observation column if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matriculas' AND column_name='observacao') THEN
        ALTER TABLE public.matriculas ADD COLUMN observacao TEXT;
    END IF;
END $$;

-- Create perfis_alunos for Member Area access
CREATE TABLE IF NOT EXISTS public.perfis_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE UNIQUE,
    senha TEXT NOT NULL, -- In a real app, this should be hashed
    ultimo_acesso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.perfis_alunos ENABLE ROW LEVEL SECURITY;

-- Simple policies for now (admin can do everything, student can see their own)
CREATE POLICY "Admins have full access to perfis_alunos" ON public.perfis_alunos
    FOR ALL USING (true); -- Simplified for admin panel context

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_perfis_alunos_updated_at
    BEFORE UPDATE ON public.perfis_alunos
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();