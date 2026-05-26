-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;

-- CLEANUP: Drop existing redundant policies to avoid confusion
-- We'll recreate them cleanly
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 1. user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage everything" ON public.user_roles FOR ALL USING (public.is_admin());
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- 2. cursos
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.cursos FOR ALL USING (public.is_admin());
CREATE POLICY "Students view courses" ON public.cursos FOR SELECT USING (public.is_student());
-- Additional policy for students to see specific courses if needed, but "is_student()" is broader.
-- The user said: "aluno" only reading on "cursos".

-- 3. aulas
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.aulas FOR ALL USING (public.is_admin());
CREATE POLICY "Students view aulas" ON public.aulas FOR SELECT USING (public.is_student());

-- 4. alunos
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.alunos FOR ALL USING (public.is_admin());
CREATE POLICY "Students view own profile" ON public.alunos FOR SELECT 
USING (email = (auth.jwt() ->> 'email'::text) OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'aluno'));
-- Better: check by email or by being the owner
CREATE POLICY "Users view own record" ON public.alunos FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() AND auth.users.email = public.alunos.email
));

-- 5. matriculas
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.matriculas FOR ALL USING (public.is_admin());
CREATE POLICY "Students view own matriculas" ON public.matriculas FOR SELECT 
USING (aluno_id IN (
    SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'::text)
));

-- 6. matricula_cursos
ALTER TABLE public.matricula_cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.matricula_cursos FOR ALL USING (public.is_admin());
CREATE POLICY "Students view own course links" ON public.matricula_cursos FOR SELECT 
USING (matricula_id IN (
    SELECT id FROM public.matriculas WHERE aluno_id IN (
        SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'::text)
    )
));

-- 7. pacotes
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.pacotes FOR ALL USING (public.is_admin());
CREATE POLICY "Public view pacotes" ON public.pacotes FOR SELECT USING (true);

-- 8. matricula_pacotes
ALTER TABLE public.matricula_pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.matricula_pacotes FOR ALL USING (public.is_admin());
CREATE POLICY "Students view own package links" ON public.matricula_pacotes FOR SELECT 
USING (matricula_id IN (
    SELECT id FROM public.matriculas WHERE aluno_id IN (
        SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'::text)
    )
));

-- 9. perfis_alunos
ALTER TABLE public.perfis_alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.perfis_alunos FOR ALL USING (public.is_admin());
CREATE POLICY "Students view own profile" ON public.perfis_alunos FOR SELECT 
USING (aluno_id IN (
    SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'::text)
));
