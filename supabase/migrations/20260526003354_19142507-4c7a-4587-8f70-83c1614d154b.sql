CREATE TYPE tipo_pacote AS ENUM ('boleto', 'cartao', 'pix');

CREATE TABLE public.pacotes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo tipo_pacote NOT NULL,
    valor_matricula NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_parcela NUMERIC(10,2) NOT NULL DEFAULT 0,
    numero_parcelas INTEGER NOT NULL DEFAULT 1,
    valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.matricula_pacotes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    matricula_id UUID NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
    pacote_id UUID NOT NULL REFERENCES public.pacotes(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matricula_pacotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode tudo em pacotes" ON public.pacotes FOR ALL USING (true);
CREATE POLICY "Admin pode tudo em matricula_pacotes" ON public.matricula_pacotes FOR ALL USING (true);
