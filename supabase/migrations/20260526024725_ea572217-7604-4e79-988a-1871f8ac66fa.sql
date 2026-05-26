-- Create payment types and status enums if they don't exist
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('taxa_matricula', 'parcela');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('aberto', 'pago', 'isento');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create parcelas table
CREATE TABLE IF NOT EXISTS public.parcelas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    matricula_id UUID NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
    tipo payment_type NOT NULL,
    numero INTEGER NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    data_vencimento DATE NOT NULL,
    status payment_status NOT NULL DEFAULT 'aberto',
    data_pagamento DATE,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can do everything on parcelas"
ON public.parcelas
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

CREATE POLICY "Students can view their own parcelas"
ON public.parcelas
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.matriculas m
        JOIN public.alunos a ON m.aluno_id = a.id
        WHERE m.id = parcelas.matricula_id
        AND a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_parcelas_matricula_id ON public.parcelas(matricula_id);
