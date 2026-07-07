
CREATE OR REPLACE FUNCTION public.gerar_comissao_por_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula_id uuid;
  v_parcela_tipo text;
  v_parcela_valor numeric(10,2);
  v_colaborador_id uuid;
  v_aluno_id uuid;
  v_vendedora text;
  v_com_avista numeric(10,2);
  v_com_parcelado numeric(10,2);
  v_com_full numeric(10,2);
  v_pacote_tipo text;
  v_tipo_pag text;
  v_valor_comissao numeric(10,2);
  v_competencia date;
BEGIN
  IF NEW.valor_pago IS NULL OR NEW.valor_pago <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.matricula_id, p.tipo, p.valor
    INTO v_matricula_id, v_parcela_tipo, v_parcela_valor
  FROM public.parcelas p
  WHERE p.id = NEW.parcela_id;

  IF v_matricula_id IS NULL OR v_parcela_tipo <> 'parcela' THEN
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

  -- Determina tipo pelo pacote (pix/cartao => avista, boleto => boleto)
  SELECT pc.tipo::text
    INTO v_pacote_tipo
  FROM public.matricula_pacotes mp
  JOIN public.pacotes pc ON pc.id = mp.pacote_id
  WHERE mp.matricula_id = v_matricula_id
  LIMIT 1;

  IF v_pacote_tipo = 'boleto' THEN
    v_tipo_pag := 'boleto';
    v_com_full := v_com_parcelado;
  ELSE
    v_tipo_pag := 'avista';
    v_com_full := v_com_avista;
  END IF;

  IF v_parcela_valor IS NULL OR v_parcela_valor <= 0 THEN
    RETURN NEW;
  END IF;

  v_valor_comissao := ROUND((NEW.valor_pago / v_parcela_valor) * v_com_full, 2);

  IF v_valor_comissao <= 0 THEN
    RETURN NEW;
  END IF;

  v_competencia := date_trunc('month', COALESCE(NEW.data_pagamento, CURRENT_DATE))::date;

  INSERT INTO public.comissoes (
    vendedora, aluno_id, matricula_id, tipo_pagamento,
    valor, competencia, status, parcela_pagamento_id
  ) VALUES (
    v_vendedora, v_aluno_id, v_matricula_id, v_tipo_pag,
    v_valor_comissao, v_competencia, 'pendente', NEW.id
  )
  ON CONFLICT (parcela_pagamento_id) WHERE estornado = false DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Garante que o trigger exista
DROP TRIGGER IF EXISTS trg_gerar_comissao_por_pagamento ON public.parcelas_pagamentos;
CREATE TRIGGER trg_gerar_comissao_por_pagamento
AFTER INSERT ON public.parcelas_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.gerar_comissao_por_pagamento();
