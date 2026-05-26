-- 1. Create a helper function to check if the current user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'administrador'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a helper function to check if the current user is a student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'aluno'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reset and Apply Policies for each table

-- TABLE: user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins have full access to user_roles" 
ON public.user_roles FOR ALL USING (is_admin());

CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT USING (auth.uid() = user_id);


-- TABLE: cursos
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to cursos" ON public.cursos;
DROP POLICY IF EXISTS "Students can view active cursos" ON public.cursos;

CREATE POLICY "Admins have full access to cursos" 
ON public.cursos FOR ALL USING (is_admin());

CREATE POLICY "Students can view active cursos" 
ON public.cursos FOR SELECT USING (is_student());


-- TABLE: aulas
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to aulas" ON public.aulas;
DROP POLICY IF EXISTS "Students can view aulas" ON public.aulas;

CREATE POLICY "Admins have full access to aulas" 
ON public.aulas FOR ALL USING (is_admin());

CREATE POLICY "Students can view aulas" 
ON public.aulas FOR SELECT USING (is_student());


-- TABLE: alunos
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to alunos" ON public.alunos;
DROP POLICY IF EXISTS "Students can view their own record" ON public.alunos;

CREATE POLICY "Admins have full access to alunos" 
ON public.alunos FOR ALL USING (is_admin());

-- A student might need to see their own data (e.g., for profile)
CREATE POLICY "Students can view their own record" 
ON public.alunos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() AND auth.users.email = public.alunos.email
  )
);


-- TABLE: pacotes
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to pacotes" ON public.pacotes;
DROP POLICY IF EXISTS "Students can view pacotes" ON public.pacotes;

CREATE POLICY "Admins have full access to pacotes" 
ON public.pacotes FOR ALL USING (is_admin());

CREATE POLICY "Students can view pacotes" 
ON public.pacotes FOR SELECT USING (is_student());


-- TABLE: matriculas
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to matriculas" ON public.matriculas;
DROP POLICY IF EXISTS "Students can view their own matriculas" ON public.matriculas;

CREATE POLICY "Admins have full access to matriculas" 
ON public.matriculas FOR ALL USING (is_admin());

CREATE POLICY "Students can view their own matriculas" 
ON public.matriculas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.alunos 
    WHERE public.alunos.id = public.matriculas.aluno_id 
    AND EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() AND auth.users.email = public.alunos.email
    )
  )
);


-- TABLE: matricula_cursos
ALTER TABLE public.matricula_cursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to matricula_cursos" ON public.matricula_cursos;
DROP POLICY IF EXISTS "Students can view their own matricula_cursos" ON public.matricula_cursos;

CREATE POLICY "Admins have full access to matricula_cursos" 
ON public.matricula_cursos FOR ALL USING (is_admin());

CREATE POLICY "Students can view their own matricula_cursos" 
ON public.matricula_cursos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.matriculas m
    JOIN public.alunos a ON a.id = m.aluno_id
    WHERE m.id = public.matricula_cursos.matricula_id
    AND EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() AND auth.users.email = a.email
    )
  )
);


-- TABLE: matricula_pacotes
ALTER TABLE public.matricula_pacotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to matricula_pacotes" ON public.matricula_pacotes;
DROP POLICY IF EXISTS "Students can view their own matricula_pacotes" ON public.matricula_pacotes;

CREATE POLICY "Admins have full access to matricula_pacotes" 
ON public.matricula_pacotes FOR ALL USING (is_admin());

CREATE POLICY "Students can view their own matricula_pacotes" 
ON public.matricula_pacotes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.matriculas m
    JOIN public.alunos a ON a.id = m.aluno_id
    WHERE m.id = public.matricula_pacotes.matricula_id
    AND EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() AND auth.users.email = a.email
    )
  )
);
