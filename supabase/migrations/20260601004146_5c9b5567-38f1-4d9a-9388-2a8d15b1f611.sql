-- Ativar RLS se não estiver ativado
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

-- Revogar permissões amplas se existirem para anon
REVOKE ALL ON public.alunos FROM anon;
REVOKE ALL ON public.contratos FROM anon;

-- Conceder apenas o necessário para anon
GRANT SELECT (id, nome) ON public.alunos TO anon;
GRANT SELECT, UPDATE ON public.contratos TO anon;

-- Políticas para contratos
DROP POLICY IF EXISTS "Anyone can view contract by token" ON public.contratos;
CREATE POLICY "Anyone can view contract by token" 
ON public.contratos 
FOR SELECT 
TO anon 
USING (true); -- Filtro de segurança é o token_unico na query

DROP POLICY IF EXISTS "Anyone can update contract by token for signature" ON public.contratos;
CREATE POLICY "Anyone can update contract by token for signature" 
ON public.contratos 
FOR UPDATE 
TO anon 
USING (status = 'pendente')
WITH CHECK (status = 'assinado');

-- Políticas para alunos (acesso via contrato)
DROP POLICY IF EXISTS "Anyone can view student name for contract" ON public.alunos;
CREATE POLICY "Anyone can view student name for contract" 
ON public.alunos 
FOR SELECT 
TO anon 
USING (
  EXISTS (
    SELECT 1 FROM public.contratos 
    WHERE contratos.aluno_id = alunos.id
  )
);

-- Garantir que as roles de serviço e autenticadas continuem funcionando
GRANT ALL ON public.contratos TO service_role;
GRANT ALL ON public.alunos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO authenticated;
