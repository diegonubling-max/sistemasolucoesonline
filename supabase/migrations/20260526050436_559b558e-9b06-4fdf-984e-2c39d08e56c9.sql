CREATE OR REPLACE FUNCTION public.criar_acesso_aluno(
  p_email TEXT,
  p_senha TEXT,
  p_ctr INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
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
      crypt(p_senha, gen_salt('bf')),
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

GRANT EXECUTE ON FUNCTION public.criar_acesso_aluno(TEXT, TEXT, INTEGER) 
TO authenticated;