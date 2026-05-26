CREATE OR REPLACE FUNCTION public.delete_pacote(p_pacote_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

GRANT EXECUTE ON FUNCTION public.delete_pacote(UUID) TO authenticated;