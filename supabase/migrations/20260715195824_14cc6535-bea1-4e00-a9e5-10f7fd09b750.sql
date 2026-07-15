
-- Overload para buscar email por CTR texto (aceita 'A0501', 'L0501', numéricos, etc.)
CREATE OR REPLACE FUNCTION public.buscar_email_por_ctr(p_ctr text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT email FROM public.alunos
  WHERE ctr = p_ctr
     OR ctr_lancamento = p_ctr
     OR (p_ctr ~ '^\d+$' AND ctr = p_ctr)
  LIMIT 1;
$function$;

-- Atualiza criar_matricula_lancamento para gravar CTR no campo ctr do aluno
CREATE OR REPLACE FUNCTION public.criar_matricula_lancamento(
  p_nome text, p_email text, p_telefone text, p_cpf text,
  p_data_nascimento date, p_forma_pagamento text, p_polo_id uuid,
  p_utm_source text DEFAULT NULL, p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL, p_utm_content text DEFAULT NULL,
  p_contrato_html text DEFAULT NULL, p_assinatura_nome text DEFAULT NULL,
  p_sexo text DEFAULT NULL
)
RETURNS TABLE(aluno_id uuid, matricula_id uuid, ctr text, senha text, ja_existia boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aluno_id UUID;
  v_matricula_id UUID;
  v_ctr TEXT;
  v_senha TEXT;
  v_esta_ativo BOOLEAN;
  v_primeiro_nome TEXT;
  v_hoje DATE := CURRENT_DATE;
  v_sexo sexo_aluno;
  v_ctr_atual TEXT;
BEGIN
  IF p_forma_pagamento NOT IN ('boleto','cartao','pix') THEN
    RAISE EXCEPTION 'forma_pagamento inválida';
  END IF;
  IF p_sexo IS NULL OR p_sexo NOT IN ('Masculino','Feminino') THEN
    RAISE EXCEPTION 'sexo inválido';
  END IF;
  v_sexo := p_sexo::sexo_aluno;

  v_primeiro_nome := lower(split_part(trim(p_nome), ' ', 1));
  v_senha := '1234' || v_primeiro_nome;

  SELECT id, ativo, ctr_lancamento, ctr
    INTO v_aluno_id, v_esta_ativo, v_ctr, v_ctr_atual
  FROM public.alunos WHERE cpf = p_cpf LIMIT 1;

  IF v_aluno_id IS NOT NULL THEN
    IF v_esta_ativo = true THEN
      RETURN QUERY SELECT v_aluno_id, NULL::UUID, COALESCE(v_ctr, v_ctr_atual), NULL::TEXT, true;
      RETURN;
    ELSE
      UPDATE public.alunos
        SET ativo = true, status = 'ativo', nome = p_nome, email = p_email,
            telefone = p_telefone, data_nascimento = p_data_nascimento, sexo = v_sexo
        WHERE id = v_aluno_id;
      IF v_ctr IS NULL THEN
        v_ctr := public.gerar_ctr_lancamento();
        UPDATE public.alunos SET ctr_lancamento = v_ctr, ctr = v_ctr, origem = 'Lançamento'
          WHERE id = v_aluno_id;
      END IF;
    END IF;
  ELSE
    v_ctr := public.gerar_ctr_lancamento();
    -- Passa ctr explicitamente para não cair no trigger que gera numérico
    INSERT INTO public.alunos (nome, email, telefone, cpf, data_nascimento, ativo, origem, sexo, polo_id, ctr_lancamento, ctr, cadastrado_por)
    VALUES (p_nome, p_email, p_telefone, p_cpf, p_data_nascimento, true, 'Lançamento', v_sexo, p_polo_id, v_ctr, v_ctr, 'Matrícula Pública')
    RETURNING id INTO v_aluno_id;
  END IF;

  INSERT INTO public.matriculas (aluno_id, polo_id, observacao, utm_source, utm_medium, utm_campaign, utm_content)
  VALUES (v_aluno_id, p_polo_id, 'Matrícula pública — Aulão', p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content)
  RETURNING id INTO v_matricula_id;

  INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
  VALUES (v_matricula_id, 'taxa_matricula', 1, 69.90, v_hoje, 'aberto', p_forma_pagamento);

  IF p_forma_pagamento = 'boleto' THEN
    FOR i IN 1..10 LOOP
      INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
      VALUES (v_matricula_id, 'parcela', i, 159.90, v_hoje + (30 * i), 'aberto', 'boleto');
    END LOOP;
  ELSIF p_forma_pagamento = 'cartao' THEN
    FOR i IN 1..12 LOOP
      INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
      VALUES (v_matricula_id, 'parcela', i, 119.90, v_hoje + (30 * i), 'aberto', 'cartao');
    END LOOP;
  ELSE
    INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
    VALUES (v_matricula_id, 'parcela', 1, 1198.00, v_hoje + 30, 'aberto', 'pix');
  END IF;

  IF p_contrato_html IS NOT NULL AND length(p_contrato_html) > 0 THEN
    INSERT INTO public.contratos (aluno_id, matricula_id, conteudo_html, status, data_assinatura, nome_confirmacao)
    VALUES (v_aluno_id, v_matricula_id, p_contrato_html, 'assinado', now(), COALESCE(p_assinatura_nome, p_nome));
  END IF;

  RETURN QUERY SELECT v_aluno_id, v_matricula_id, v_ctr, v_senha, false;
END;
$function$;
