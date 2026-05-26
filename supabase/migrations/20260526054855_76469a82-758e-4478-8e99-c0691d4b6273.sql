CREATE OR REPLACE FUNCTION public.redefinir_senha_aluno(
  p_email TEXT,
  p_nova_senha TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf')),
      updated_at = NOW()
  WHERE email = p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redefinir_senha_aluno(TEXT, TEXT) 
TO authenticated;