-- 1. Secure has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. Secure criar_acesso_aluno
CREATE OR REPLACE FUNCTION public.criar_acesso_aluno(p_email text, p_senha text, p_ctr integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Verificar se usuário já existe
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  -- Se não existe, criar
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt(p_senha, extensions.gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}'
    )
    RETURNING id INTO v_user_id;
  END IF;

  -- Salvar papel de aluno
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'aluno')
  ON CONFLICT (user_id, role) DO NOTHING;

END;
$$;

-- 3. Secure delete_pacote
CREATE OR REPLACE FUNCTION public.delete_pacote(p_pacote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Verificar se pacote está vinculado a alguma matrícula
  IF EXISTS (
    SELECT 1 FROM public.matricula_pacotes mp
    WHERE mp.pacote_id = p_pacote_id
  ) THEN
    RAISE EXCEPTION 'Pacote vinculado a matrículas existentes';
  END IF;

  DELETE FROM public.pacotes WHERE id = p_pacote_id;
END;
$$;

-- 4. Secure delete_aluno_completo
CREATE OR REPLACE FUNCTION public.delete_aluno_completo(p_aluno_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_email TEXT;
  v_auth_id UUID;
  v_matricula_id UUID;
BEGIN
  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT a.email INTO v_email 
  FROM public.alunos a
  WHERE a.id = p_aluno_id;

  FOR v_matricula_id IN 
    SELECT m.id FROM public.matriculas m 
    WHERE m.aluno_id = p_aluno_id
  LOOP
    DELETE FROM public.parcelas p
    WHERE p.matricula_id = v_matricula_id;

    DELETE FROM public.matricula_cursos mc
    WHERE mc.matricula_id = v_matricula_id;

    DELETE FROM public.matricula_pacotes mp
    WHERE mp.matricula_id = v_matricula_id;
  END LOOP;

  DELETE FROM public.matriculas m 
  WHERE m.aluno_id = p_aluno_id;

  DELETE FROM public.user_roles ur
  WHERE ur.user_id = (
    SELECT u.id FROM auth.users u WHERE u.email = v_email
  );

  DELETE FROM public.alunos a 
  WHERE a.id = p_aluno_id;

  SELECT u.id INTO v_auth_id 
  FROM auth.users u
  WHERE u.email = v_email;

  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users u WHERE u.id = v_auth_id;
  END IF;
END;
$$;

-- 5. Revoke public execute
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
