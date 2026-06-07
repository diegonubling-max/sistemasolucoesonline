-- Drop the existing table if it exists
DROP TABLE IF EXISTS public.colaborador_permissoes;

-- Create the table with the correct schema
CREATE TABLE public.colaborador_permissoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    ver_alunos BOOLEAN DEFAULT FALSE,
    cadastrar_alunos BOOLEAN DEFAULT FALSE,
    fazer_matriculas BOOLEAN DEFAULT FALSE,
    ver_financeiro BOOLEAN DEFAULT FALSE,
    dar_baixa_pagamentos BOOLEAN DEFAULT FALSE,
    agendar_provas BOOLEAN DEFAULT FALSE,
    ver_relatorios BOOLEAN DEFAULT FALSE,
    ver_configuracoes BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant access to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaborador_permissoes TO authenticated;
GRANT ALL ON public.colaborador_permissoes TO service_role;

-- Enable RLS
ALTER TABLE public.colaborador_permissoes ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Enable all for authenticated users" ON public.colaborador_permissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_colaborador_permissoes_updated_at BEFORE UPDATE ON public.colaborador_permissoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
