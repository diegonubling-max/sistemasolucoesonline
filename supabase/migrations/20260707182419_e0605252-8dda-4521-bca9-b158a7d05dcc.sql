
-- Rewrite commission generation: only on Parcela 1 (tipo='parcela', numero=1), full value, one per matricula

CREATE OR REPLACE FUNCTION public.gerar_comissao_por_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula_id uuid;
  v_parcela_tipo text;
  v_parcela_numero integer;
  v_colaborador_id uuid;
  v_aluno_id uuid;
  v_vendedora text;
  v_com_avista numeric(10,2);
  v_com_parcelado numeric(10,2);
  v_pacote_tipo text;
  v_tipo_pag text;
  v_valor_comissao numeric(10,2);
  v_competencia date;
BEGIN
  IF NEW.valor_pago IS NULL OR NEW.valor_pago <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.matricula_id, p.tipo, p.numero
    INTO v_matricula_id, v_parcela_tipo, v_parcela_numero
  FROM public.parcelas p
  WHERE p.id = NEW.parcela_id;

  -- Somente Parcela 1 do tipo 'parcela' gera comissão (nunca taxa_matricula)
  IF v_matricula_id IS NULL OR v_parcela_tipo <> 'parcela' OR COALESCE(v_parcela_numero, 0) <> 1 THEN
    RETURN NEW;
  END IF;

  -- Impede duplicata: uma comissão por matrícula
  IF EXISTS (
    SELECT 1 FROM public.comissoes
    WHERE matricula_id = v_matricula_id
      AND COALESCE(estornado, false) = false
  ) THEN
    RETURN NEW;
  END IF;

  SELECT m.colaborador_id, m.aluno_id
    INTO v_colaborador_id, v_aluno_id
  FROM public.matriculas m WHERE m.id = v_matricula_id;

  IF v_colaborador_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome,
         COALESCE(comissao_avista, 120.00),
         COALESCE(comissao_parcelado, 50.00)
    INTO v_vendedora, v_com_avista, v_com_parcelado
  FROM public.colaboradores WHERE id = v_colaborador_id;

  IF v_vendedora IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pc.tipo::text
    INTO v_pacote_tipo
  FROM public.matricula_pacotes mp
  JOIN public.pacotes pc ON pc.id = mp.pacote_id
  WHERE mp.matricula_id = v_matricula_id
  LIMIT 1;

  IF v_pacote_tipo = 'boleto' THEN
    v_tipo_pag := 'boleto';
    v_valor_comissao := v_com_parcelado;
  ELSE
    v_tipo_pag := 'avista';
    v_valor_comissao := v_com_avista;
  END IF;

  v_competencia := COALESCE(NEW.data_pagamento, CURRENT_DATE);

  INSERT INTO public.comissoes (
    vendedora, aluno_id, matricula_id, tipo_pagamento,
    valor, competencia, status, parcela_pagamento_id
  ) VALUES (
    v_vendedora, v_aluno_id, v_matricula_id, v_tipo_pag,
    v_valor_comissao, v_competencia, 'pendente', NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Também ajusta o trigger de status='pago' direto em parcelas (baixa total sem passar por parcelas_pagamentos)
CREATE OR REPLACE FUNCTION public.gerar_comissao_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_colaborador_id uuid;
  v_aluno_id uuid;
  v_vendedora text;
  v_tipo_pag text;
  v_valor numeric(10,2);
  v_competencia date;
  v_com_avista numeric(10,2);
  v_com_parcelado numeric(10,2);
  v_pacote_tipo text;
BEGIN
  IF NEW.status <> 'pago' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;
  -- Somente Parcela 1 do tipo 'parcela'
  IF NEW.tipo <> 'parcela' OR COALESCE(NEW.numero, 0) <> 1 THEN
    RETURN NEW;
  END IF;

  -- Impede duplicata por matrícula
  IF EXISTS (
    SELECT 1 FROM public.comissoes
    WHERE matricula_id = NEW.matricula_id
      AND COALESCE(estornado, false) = false
  ) THEN
    RETURN NEW;
  END IF;

  SELECT m.colaborador_id, m.aluno_id INTO v_colaborador_id, v_aluno_id
  FROM public.matriculas m WHERE m.id = NEW.matricula_id;
  IF v_colaborador_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome, COALESCE(comissao_avista, 120.00), COALESCE(comissao_parcelado, 50.00)
    INTO v_vendedora, v_com_avista, v_com_parcelado
  FROM public.colaboradores WHERE id = v_colaborador_id;
  IF v_vendedora IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pc.tipo::text INTO v_pacote_tipo
  FROM public.matricula_pacotes mp
  JOIN public.pacotes pc ON pc.id = mp.pacote_id
  WHERE mp.matricula_id = NEW.matricula_id
  LIMIT 1;

  IF v_pacote_tipo = 'boleto' THEN
    v_tipo_pag := 'boleto';
    v_valor := v_com_parcelado;
  ELSE
    v_tipo_pag := 'avista';
    v_valor := v_com_avista;
  END IF;

  v_competencia := COALESCE(NEW.data_pagamento, CURRENT_DATE);

  INSERT INTO public.comissoes (
    vendedora, aluno_id, matricula_id, tipo_pagamento, valor, competencia, status
  ) VALUES (
    v_vendedora, v_aluno_id, NEW.matricula_id, v_tipo_pag, v_valor, v_competencia, 'pendente'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
