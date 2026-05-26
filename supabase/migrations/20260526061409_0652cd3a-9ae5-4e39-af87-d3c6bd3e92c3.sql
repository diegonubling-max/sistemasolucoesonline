-- 1. Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matricula_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matricula_pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_alunos ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename); 
    END LOOP; 
END $$;

-- 3. USER_ROLES Policies (Prevent privilege escalation)
-- Admin can manage everything
CREATE POLICY "Admins full access on user_roles" ON public.user_roles
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- 4. ALUNOS Policies
-- Admin full access
CREATE POLICY "Admins full access on alunos" ON public.alunos
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Students view own data (by email)
CREATE POLICY "Students view own profile" ON public.alunos
FOR SELECT USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 5. CURSOS & AULAS Policies
-- Admin full access
CREATE POLICY "Admins full access on cursos" ON public.cursos
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins full access on aulas" ON public.aulas
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Authenticated users (Students) view active courses and lessons
CREATE POLICY "Authenticated view active courses" ON public.cursos
FOR SELECT USING (ativo = true);

CREATE POLICY "Authenticated view active aulas" ON public.aulas
FOR SELECT USING (ativo = true);

-- 6. MATRICULAS & MATRICULA_CURSOS Policies
-- Admin full access
CREATE POLICY "Admins full access on matriculas" ON public.matriculas
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins full access on matricula_cursos" ON public.matricula_cursos
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Students view own matriculas
CREATE POLICY "Students view own matriculas" ON public.matriculas
FOR SELECT USING (
  aluno_id IN (
    SELECT id FROM public.alunos 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Students view own matricula_cursos" ON public.matricula_cursos
FOR SELECT USING (
  matricula_id IN (
    SELECT id FROM public.matriculas 
    WHERE aluno_id IN (
      SELECT id FROM public.alunos 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- 7. PARCELAS Policies
-- Admin full access
CREATE POLICY "Admins full access on parcelas" ON public.parcelas
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Students view own parcelas
CREATE POLICY "Students view own parcelas" ON public.parcelas
FOR SELECT USING (
  matricula_id IN (
    SELECT id FROM public.matriculas 
    WHERE aluno_id IN (
      SELECT id FROM public.alunos 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- 8. PACOTES & MATRICULA_PACOTES Policies (Cleaning up/Standardizing)
CREATE POLICY "Admins full access on pacotes" ON public.pacotes
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins full access on matricula_pacotes" ON public.matricula_pacotes
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Students view own matricula_pacotes
CREATE POLICY "Students view own matricula_pacotes" ON public.matricula_pacotes
FOR SELECT USING (
  matricula_id IN (
    SELECT id FROM public.matriculas 
    WHERE aluno_id IN (
      SELECT id FROM public.alunos 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- 9. PERFIS_ALUNOS Policies
CREATE POLICY "Admins full access on perfis_alunos" ON public.perfis_alunos
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Students view own details" ON public.perfis_alunos
FOR SELECT USING (
  aluno_id IN (
    SELECT id FROM public.alunos 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- 10. Clean up old functions
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_student();
