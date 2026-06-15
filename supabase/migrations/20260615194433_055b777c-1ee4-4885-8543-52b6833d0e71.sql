CREATE OR REPLACE FUNCTION public.buscar_email_por_ctr(p_ctr integer)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.alunos WHERE ctr = p_ctr LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_email_por_ctr(integer) TO anon, authenticated;