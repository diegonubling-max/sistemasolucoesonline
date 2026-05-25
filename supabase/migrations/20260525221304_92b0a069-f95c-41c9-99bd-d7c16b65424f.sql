-- Add RLS policies for 'aluno' role

-- Alunos can see their own data
CREATE POLICY "Students can view their own profile" ON public.alunos
    FOR SELECT
    TO authenticated
    USING (email = auth.jwt() ->> 'email' AND has_role(auth.uid(), 'aluno'::app_role));

-- Matriculas: students can see their own enrollments
CREATE POLICY "Students can view their own enrollments" ON public.matriculas
    FOR SELECT
    TO authenticated
    USING (aluno_id IN (
        SELECT id FROM public.alunos 
        WHERE email = auth.jwt() ->> 'email'
    ));

-- Matricula_cursos: students can see their own courses links
CREATE POLICY "Students can view their own course links" ON public.matricula_cursos
    FOR SELECT
    TO authenticated
    USING (matricula_id IN (
        SELECT id FROM public.matriculas 
        WHERE aluno_id IN (
            SELECT id FROM public.alunos 
            WHERE email = auth.jwt() ->> 'email'
        )
    ));

-- Cursos: students can see courses they are enrolled in
CREATE POLICY "Students can view enrolled courses" ON public.cursos
    FOR SELECT
    TO authenticated
    USING (id IN (
        SELECT curso_id FROM public.matricula_cursos
        WHERE matricula_id IN (
            SELECT id FROM public.matriculas 
            WHERE aluno_id IN (
                SELECT id FROM public.alunos 
                WHERE email = auth.jwt() ->> 'email'
            )
        )
    ));

-- Aulas: students can see lessons of enrolled courses
CREATE POLICY "Students can view lessons of enrolled courses" ON public.aulas
    FOR SELECT
    TO authenticated
    USING (curso_id IN (
        SELECT id FROM public.cursos
        WHERE id IN (
            SELECT curso_id FROM public.matricula_cursos
            WHERE matricula_id IN (
                SELECT id FROM public.matriculas 
                WHERE aluno_id IN (
                    SELECT id FROM public.alunos 
                    WHERE email = auth.jwt() ->> 'email'
                )
            )
        )
    ) AND ativo = true);

-- User Roles: users can see their own role
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());