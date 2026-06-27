CREATE OR REPLACE FUNCTION public.ajustar_ctr_pular_13()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ctr IS NULL THEN
    NEW.ctr := nextval('public.alunos_ctr_seq');
  END IF;
  WHILE (NEW.ctr % 100) = 13 LOOP
    NEW.ctr := nextval('public.alunos_ctr_seq');
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ajustar_ctr_pular_13 ON public.alunos;
CREATE TRIGGER trg_ajustar_ctr_pular_13
BEFORE INSERT ON public.alunos
FOR EACH ROW
EXECUTE FUNCTION public.ajustar_ctr_pular_13();