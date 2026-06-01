-- Reinstalar a política de administração para a tabela alunos
DROP POLICY IF EXISTS "Admins full access on alunos" ON public.alunos;
CREATE POLICY "Admins full access on alunos"
ON public.alunos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Garantir que a política de visualização por e-mail (alunos) continue funcionando
DROP POLICY IF EXISTS "Students view own profile" ON public.alunos;
CREATE POLICY "Students view own profile"
ON public.alunos
FOR SELECT
TO authenticated
USING (email = (SELECT auth.jwt() ->> 'email'));

-- Garantir que a política de atualização por e-mail (alunos) continue funcionando
DROP POLICY IF EXISTS "Students update own profile" ON public.alunos;
CREATE POLICY "Students update own profile"
ON public.alunos
FOR UPDATE
TO authenticated
USING (email = (SELECT auth.jwt() ->> 'email'));
