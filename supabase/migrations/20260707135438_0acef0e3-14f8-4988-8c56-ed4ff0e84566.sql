ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS parcela_pagamento_id uuid
    REFERENCES public.parcelas_pagamentos(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.comissoes_unique_matricula_tipo_active;

CREATE UNIQUE INDEX IF NOT EXISTS comissoes_unique_parcela_pagamento_active
  ON public.comissoes (parcela_pagamento_id)
  WHERE estornado = false AND parcela_pagamento_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_gerar_comissao_pagamento ON public.parcelas;

CREATE OR REPLACE FUNCTION public.gerar_comissao_por_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_matricula_id uuid;
  v_parcela_tipo text;
  v_colaborador_id uuid;
  v_aluno_id uuid;
  v_vendedora text;
  v_com_avista numeric(10,2);
  v_com_parcelado numeric(10,2);
  v_com_full numeric(10,2);
  v_tipo_pag text;
  v_total_parcelas integer;
  v_total_valor numeric(10,2);
  v_valor_comissao numeric(10,2);
  v_competencia date;
BEGIN
  IF NEW.valor_pago IS NULL OR NEW.valor_pago <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.matricula_id, p.tipo
    INTO v_matricula_id, v_parcela_tipo
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

  SELECT COUNT(*), COALESCE(SUM(valor), 0)
    INTO v_total_parcelas, v_total_valor
  FROM public.parcelas
  WHERE matricula_id = v_matricula_id
    AND tipo = 'parcela';

  IF v_total_valor <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_total_parcelas > 1 THEN
    v_tipo_pag := 'boleto';
    v_com_full := v_com_parcelado;
  ELSE
    v_tipo_pag := 'avista';
    v_com_full := v_com_avista;
  END IF;

  v_valor_comissao := ROUND((NEW.valor_pago / v_total_valor) * v_com_full, 2);

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

DROP TRIGGER IF EXISTS trg_gerar_comissao_por_pagamento ON public.parcelas_pagamentos;
CREATE TRIGGER trg_gerar_comissao_por_pagamento
AFTER INSERT ON public.parcelas_pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.gerar_comissao_por_pagamento();