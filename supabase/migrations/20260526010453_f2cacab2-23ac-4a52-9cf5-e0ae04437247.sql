-- Fix search_path for helper functions
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_student() SET search_path = public;

-- Revoke public execution and restrict to authenticated users
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_student() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
