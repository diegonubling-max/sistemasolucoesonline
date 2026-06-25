
ALTER TABLE public.cursos_vitrine
  ADD COLUMN IF NOT EXISTS preco_normal numeric(10,2),
  ADD COLUMN IF NOT EXISTS preco_com_pontos numeric(10,2),
  ADD COLUMN IF NOT EXISTS pontos_necessarios integer DEFAULT 300,
  ADD COLUMN IF NOT EXISTS resgatado_com_pontos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pontos_usados integer,
  ADD COLUMN IF NOT EXISTS data_resgate timestamptz;

CREATE OR REPLACE FUNCTION public.resgatar_curso_vitrine(p_vitrine_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id uuid;
  v_curso_id uuid;
  v_pontos_nec integer;
  v_preco numeric(10,2);
  v_polo_id uuid;
  v_email text;
  v_saldo integer;
  v_resgatado boolean;
  v_matricula_id uuid;
BEGIN
  SELECT cv.aluno_id, cv.curso_id, COALESCE(cv.pontos_necessarios,300),
         COALESCE(cv.preco_com_pontos, cv.preco_pix), cv.resgatado_com_pontos,
         a.polo_id, a.email
    INTO v_aluno_id, v_curso_id, v_pontos_nec, v_preco, v_resgatado, v_polo_id, v_email
  FROM public.cursos_vitrine cv
  JOIN public.alunos a ON a.id = cv.aluno_id
  WHERE cv.id = p_vitrine_id;

  IF v_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Item de vitrine não encontrado';
  END IF;
  IF v_resgatado THEN
    RAISE EXCEPTION 'Curso já resgatado';
  END IF;

  -- Permissão: admin OU o próprio aluno
  IF NOT (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.jwt() ->> 'email' = v_email
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(pontos_disponiveis,0) INTO v_saldo
    FROM public.milhas_eja WHERE aluno_id = v_aluno_id FOR UPDATE;
  IF COALESCE(v_saldo,0) < v_pontos_nec THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Desconta pontos
  UPDATE public.milhas_eja
     SET pontos_disponiveis = pontos_disponiveis - v_pontos_nec,
         updated_at = now()
   WHERE aluno_id = v_aluno_id;

  INSERT INTO public.milhas_eja_historico (aluno_id, pontos, tipo, descricao)
  VALUES (v_aluno_id, -v_pontos_nec, 'resgate_vitrine',
          'Resgate de curso na vitrine');

  -- Cria matrícula gratuita + vínculo do curso
  INSERT INTO public.matriculas (aluno_id, polo_id, observacao)
  VALUES (v_aluno_id, v_polo_id, 'Resgate com Milhas EJA')
  RETURNING id INTO v_matricula_id;

  INSERT INTO public.matricula_cursos (matricula_id, curso_id)
  VALUES (v_matricula_id, v_curso_id);

  UPDATE public.cursos_vitrine
     SET resgatado_com_pontos = true,
         pontos_usados = v_pontos_nec,
         data_resgate = now(),
         ativo = false
   WHERE id = p_vitrine_id;

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_id', v_matricula_id,
    'pontos_usados', v_pontos_nec,
    'saldo_restante', v_saldo - v_pontos_nec
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resgatar_curso_vitrine(uuid) TO authenticated;
