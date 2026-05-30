-- Ensure RLS is enabled
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone authenticated can view configurations" ON public.configuracoes;
DROP POLICY IF EXISTS "Authenticated users can update configurations" ON public.configuracoes;

-- Create more specific policies for admins
-- Permite que usuários com role 'admin' visualizem as configurações
CREATE POLICY "Admins can view configurations" 
ON public.configuracoes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Permite que usuários com role 'admin' atualizem as configurações
CREATE POLICY "Admins can update configurations" 
ON public.configuracoes 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Se precisar que alunos logados vejam algumas configs (como nome da escola), 
-- podemos manter uma política para autenticados apenas para SELECT
CREATE POLICY "Authenticated users can view configurations" 
ON public.configuracoes 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Grants
GRANT SELECT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
