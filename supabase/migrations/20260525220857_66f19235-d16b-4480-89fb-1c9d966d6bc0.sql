-- Fix search path for updated_at function
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- Refine RLS policy for perfis_alunos
DROP POLICY IF EXISTS "Admins have full access to perfis_alunos" ON public.perfis_alunos;

CREATE POLICY "Admins have full access to perfis_alunos" ON public.perfis_alunos
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);