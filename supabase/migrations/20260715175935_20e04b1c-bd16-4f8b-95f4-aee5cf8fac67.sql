
-- 1. Adiciona valor 'Lançamento' ao enum origem_aluno
ALTER TYPE public.origem_aluno ADD VALUE IF NOT EXISTS 'Lançamento';

-- 2. Adiciona coluna ctr_lancamento em alunos
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS ctr_lancamento TEXT UNIQUE;

-- 3. Cria sequence começando em 501
CREATE SEQUENCE IF NOT EXISTS public.ctr_lancamento_seq START WITH 501 INCREMENT BY 1;
GRANT USAGE ON SEQUENCE public.ctr_lancamento_seq TO anon, authenticated, service_role;

-- 4. Adiciona colunas UTM em matriculas
ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- 5. Função pública para criar matrícula de lançamento (atômica)
CREATE OR REPLACE FUNCTION public.criar_matricula_lancamento(
  p_nome TEXT,
  p_email TEXT,
  p_telefone TEXT,
  p_cpf TEXT,
  p_data_nascimento DATE,
  p_forma_pagamento TEXT,      -- 'boleto' ou 'cartao'
  p_polo_id UUID,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL
)
RETURNS TABLE(aluno_id UUID, matricula_id UUID, ctr TEXT, senha TEXT, ja_existia BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id UUID;
  v_matricula_id UUID;
  v_ctr TEXT;
  v_senha TEXT;
  v_ja_existia BOOLEAN := false;
  v_primeiro_nome TEXT;
  v_hoje DATE := CURRENT_DATE;
BEGIN
  -- Validação
  IF p_forma_pagamento NOT IN ('boleto', 'cartao') THEN
    RAISE EXCEPTION 'forma_pagamento inválida';
  END IF;

  v_primeiro_nome := lower(split_part(trim(p_nome), ' ', 1));
  v_senha := '1234' || v_primeiro_nome;

  -- Verifica se CPF já existe
  SELECT id, ativo, ctr_lancamento INTO v_aluno_id, v_ja_existia, v_ctr
  FROM public.alunos WHERE cpf = p_cpf LIMIT 1;

  IF v_aluno_id IS NOT NULL THEN
    IF v_ja_existia = true THEN
      -- Ativo: retorna sem criar
      RETURN QUERY SELECT v_aluno_id, NULL::UUID, v_ctr, NULL::TEXT, true;
      RETURN;
    ELSE
      -- Inativo: reativa
      UPDATE public.alunos
        SET ativo = true, status = 'ativo', nome = p_nome, email = p_email,
            telefone = p_telefone, data_nascimento = p_data_nascimento
        WHERE id = v_aluno_id;
      IF v_ctr IS NULL THEN
        v_ctr := 'L' || lpad(nextval('public.ctr_lancamento_seq')::text, 4, '0');
        UPDATE public.alunos SET ctr_lancamento = v_ctr, origem = 'Lançamento' WHERE id = v_aluno_id;
      END IF;
      v_ja_existia := false;
    END IF;
  ELSE
    -- Novo aluno
    v_ctr := 'L' || lpad(nextval('public.ctr_lancamento_seq')::text, 4, '0');
    INSERT INTO public.alunos (nome, email, telefone, cpf, data_nascimento, ativo, origem, sexo, polo_id, ctr_lancamento, cadastrado_por)
    VALUES (p_nome, p_email, p_telefone, p_cpf, p_data_nascimento, true, 'Lançamento', 'M', p_polo_id, v_ctr, 'Matrícula Pública')
    RETURNING id INTO v_aluno_id;
  END IF;

  -- Cria matrícula
  INSERT INTO public.matriculas (aluno_id, polo_id, observacao, utm_source, utm_medium, utm_campaign, utm_content)
  VALUES (v_aluno_id, p_polo_id, 'Matrícula pública — Aulão', p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content)
  RETURNING id INTO v_matricula_id;

  -- Cria taxa de matrícula
  INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
  VALUES (v_matricula_id, 'taxa_matricula', 1, 69.90, v_hoje + INTERVAL '3 days', 'aberto', p_forma_pagamento);

  -- Cria parcelas
  IF p_forma_pagamento = 'boleto' THEN
    -- 1 entrada de 199,90 + 9 de 159,90
    INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
    VALUES (v_matricula_id, 'parcela', 1, 199.90, v_hoje + INTERVAL '7 days', 'aberto', 'boleto');
    FOR i IN 2..10 LOOP
      INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
      VALUES (v_matricula_id, 'parcela', i, 159.90, v_hoje + ((i-1) || ' months')::interval, 'aberto', 'boleto');
    END LOOP;
  ELSE
    -- 12 de 99,90
    FOR i IN 1..12 LOOP
      INSERT INTO public.parcelas (matricula_id, tipo, numero, valor, data_vencimento, status, forma_pagamento)
      VALUES (v_matricula_id, 'parcela', i, 99.90, v_hoje + ((i-1) || ' months')::interval, 'aberto', 'cartao');
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_aluno_id, v_matricula_id, v_ctr, v_senha, v_ja_existia;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_matricula_lancamento(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Permite anon buscar o modelo de contrato ativo (necessário para checkout público)
GRANT SELECT ON public.modelos_contrato TO anon;
