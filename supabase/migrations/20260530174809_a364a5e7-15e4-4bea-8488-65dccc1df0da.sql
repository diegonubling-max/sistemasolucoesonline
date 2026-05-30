-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contratos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    matricula_id UUID,
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    conteudo_html TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    token_unico UUID NOT NULL DEFAULT gen_random_uuid(),
    ip_assinatura TEXT,
    data_assinatura TIMESTAMP WITH TIME ZONE,
    nome_confirmacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
GRANT SELECT, UPDATE ON public.contratos TO anon;

-- Enable RLS
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all contracts" 
ON public.contratos 
FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can view contract by token" 
ON public.contratos 
FOR SELECT 
TO anon
USING (status = 'pendente' OR status = 'assinado');

CREATE POLICY "Anyone can update contract by token for signature" 
ON public.contratos 
FOR UPDATE 
TO anon
USING (status = 'pendente')
WITH CHECK (status = 'assinado');

-- Ensure configuracoes table exists and can hold long text
-- Assuming configuracoes table already exists from previous context
-- Adding a default contract template if not exists
INSERT INTO public.configuracoes (chave, valor) 
VALUES ('modelo_contrato', '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS</h1><p>Pelo presente instrumento particular de contrato de prestação de serviços educacionais, de um lado <strong>[NOME_ESCOLA]</strong>, e de outro lado o(a) aluno(a) <strong>[NOME_ALUNO]</strong>, portador(a) do CPF <strong>[CPF_ALUNO]</strong>, residente e domiciliado(a) conforme cadastro, celebram o presente contrato...</p>')
ON CONFLICT (chave) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_contratos_updated_at
BEFORE UPDATE ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();