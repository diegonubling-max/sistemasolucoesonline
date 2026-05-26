-- 1. Remove insecure legacy function
DROP FUNCTION IF EXISTS public.is_aluno();

-- 2. Secure redefinir_senha_aluno
CREATE OR REPLACE FUNCTION public.redefinir_senha_aluno(p_email text, p_nova_senha text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'extensions', 'public', 'auth'
AS $$
BEGIN
  -- Ensure only admins can reset other's passwords
  -- (Assuming admin check is handled in the UI/Policy or we can add it here too)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem redefinir senhas.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_nova_senha, extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE email = p_email;
END;
$$;

-- 3. Secure delete_user_auth
CREATE OR REPLACE FUNCTION public.delete_user_auth(user_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
DECLARE
  auth_user_id UUID;
BEGIN
  -- Check admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT id INTO auth_user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = auth_user_id;
  END IF;
END;
$$;

-- 4. Revoke public execute on sensitive functions
REVOKE EXECUTE ON FUNCTION public.redefinir_senha_aluno(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_auth(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_acesso_aluno(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_pacote(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_aluno_completo(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.redefinir_senha_aluno(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_auth(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_acesso_aluno(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_pacote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_aluno_completo(uuid) TO authenticated;
