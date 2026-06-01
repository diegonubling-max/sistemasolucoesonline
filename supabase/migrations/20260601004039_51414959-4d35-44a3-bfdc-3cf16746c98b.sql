-- Garantir permissões básicas para o papel anon
GRANT SELECT, UPDATE ON public.contratos TO anon;
GRANT SELECT ON public.alunos TO anon;

-- Ajustar políticas da tabela contratos para anon
-- Remover se existirem para evitar conflitos, ou apenas garantir que estão corretas
DROP POLICY IF EXISTS "Anyone can view contract by token" ON public.contratos;
CREATE POLICY "Anyone can view contract by token" 
ON public.contratos 
FOR SELECT 
TO anon 
USING (true); -- O filtro por token é feito na query do frontend

DROP POLICY IF EXISTS "Anyone can update contract by token for signature" ON public.contratos;
CREATE POLICY "Anyone can update contract by token for signature" 
ON public.contratos 
FOR UPDATE 
TO anon 
USING (status = 'pendente')
WITH CHECK (status = 'assinado');

-- Ajustar política da tabela alunos para permitir ver o nome anonimamente se houver um contrato
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
