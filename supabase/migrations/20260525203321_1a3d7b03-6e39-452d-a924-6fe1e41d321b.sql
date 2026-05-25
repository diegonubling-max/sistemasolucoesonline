
CREATE OR REPLACE FUNCTION public.calc_menor_idade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.menor_de_idade := (NEW.data_nascimento > (CURRENT_DATE - INTERVAL '18 years'));
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
