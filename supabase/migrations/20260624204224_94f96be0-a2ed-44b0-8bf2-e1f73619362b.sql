-- 1) Dedupe keeping highest percentual_assistido per (aluno_id, aula_id)
DELETE FROM public.aluno_aulas_assistidas a
USING public.aluno_aulas_assistidas b
WHERE a.aluno_id = b.aluno_id
  AND a.aula_id = b.aula_id
  AND (
    a.percentual_assistido < b.percentual_assistido
    OR (a.percentual_assistido = b.percentual_assistido AND a.ctid < b.ctid)
  );

-- 2) Unique constraint
ALTER TABLE public.aluno_aulas_assistidas
  DROP CONSTRAINT IF EXISTS aluno_aulas_assistidas_aluno_id_aula_id_key;
ALTER TABLE public.aluno_aulas_assistidas
  ADD CONSTRAINT aluno_aulas_assistidas_aluno_id_aula_id_key UNIQUE (aluno_id, aula_id);

-- 3) Atualizar RPC para fazer upsert em vez de insert duplicado
CREATE OR REPLACE FUNCTION public.registrar_aula_assistida(p_aluno_id uuid, p_aula_id uuid, p_curso_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.aluno_aulas_assistidas (aluno_id, aula_id, curso_id, assistida_em)
  VALUES (p_aluno_id, p_aula_id, p_curso_id, NOW())
  ON CONFLICT (aluno_id, aula_id) DO UPDATE
    SET assistida_em = NOW();
END;
$function$;
