-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create cursos_vitrine table
CREATE TABLE IF NOT EXISTS public.cursos_vitrine (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    preco_pix NUMERIC(10, 2),
    preco_cartao NUMERIC(10, 2),
    max_parcelas INTEGER DEFAULT 12,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(aluno_id, curso_id)
);

-- Grant permissions
GRANT SELECT ON public.cursos_vitrine TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cursos_vitrine TO authenticated;
GRANT ALL ON public.cursos_vitrine TO service_role;

-- Enable RLS
ALTER TABLE public.cursos_vitrine ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cursos_vitrine' 
        AND policyname = 'Alunos podem ver sua própria vitrine'
    ) THEN
        CREATE POLICY "Alunos podem ver sua própria vitrine" 
        ON public.cursos_vitrine 
        FOR SELECT 
        TO authenticated 
        USING (
            aluno_id IN (
                SELECT id FROM public.alunos WHERE email = auth.jwt() ->> 'email'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cursos_vitrine' 
        AND policyname = 'Admins podem tudo na vitrine'
    ) THEN
        CREATE POLICY "Admins podem tudo na vitrine" 
        ON public.cursos_vitrine 
        FOR ALL 
        TO authenticated 
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() AND role::text = 'admin'
            )
        );
    END IF;
END $$;

-- Trigger for updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cursos_vitrine_updated_at') THEN
        CREATE TRIGGER update_cursos_vitrine_updated_at
        BEFORE UPDATE ON public.cursos_vitrine
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;