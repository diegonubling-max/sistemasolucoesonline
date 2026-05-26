CREATE POLICY "Students update own profile" ON public.alunos 
FOR UPDATE 
TO authenticated 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));