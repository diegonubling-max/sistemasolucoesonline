-- Garantir que as tabelas existam com a estrutura correta se necessário
CREATE TABLE IF NOT EXISTS public.colaboradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    polo_id UUID REFERENCES public.polos(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    setor TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.colaborador_permissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE UNIQUE,
    ver_alunos BOOLEAN DEFAULT false,
    cadastrar_alunos BOOLEAN DEFAULT false,
    fazer_matriculas BOOLEAN DEFAULT false,
    ver_financeiro BOOLEAN DEFAULT false,
    dar_baixa_pagamentos BOOLEAN DEFAULT false,
    agendar_provas BOOLEAN DEFAULT false,
    ver_relatorios BOOLEAN DEFAULT false,
    ver_configuracoes BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Adicionar coluna na matricula se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matriculas' AND column_name = 'colaborador_id') THEN
        ALTER TABLE public.matriculas ADD COLUMN colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL;
    END IF;
END $$;

-- RLS e Permissões
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaborador_permissoes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaboradores TO authenticated;
GRANT ALL ON public.colaboradores TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaborador_permissoes TO authenticated;
GRANT ALL ON public.colaborador_permissoes TO service_role;

-- Políticas básicas (Admin pode tudo)
CREATE POLICY "Admin pode gerenciar colaboradores" ON public.colaboradores FOR ALL USING (true);
CREATE POLICY "Admin pode gerenciar permissoes" ON public.colaborador_permissoes FOR ALL USING (true);
