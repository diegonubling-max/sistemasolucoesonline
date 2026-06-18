
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS comissao_avista numeric(10,2) DEFAULT 120.00,
  ADD COLUMN IF NOT EXISTS comissao_parcelado numeric(10,2) DEFAULT 50.00;

UPDATE public.colaboradores
  SET comissao_avista = 150.00, comissao_parcelado = 70.00
  WHERE email = 'altnetervera.correa06@gmail.com';

CREATE OR REPLACE FUNCTION public.gerar_comissao_pagamento()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_colaborador_id uuid;
  v_aluno_id uuid;
  v_vendedora text;
  v_tipo_pag text;
  v_valor numeric(10,2);
  v_competencia date;
  v_total_parcelas integer;
  v_com_avista numeric(10,2);
  v_com_parcelado numeric(10,2);
BEGIN
  IF NEW.status <> 'pago' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;
  IF NEW.tipo <> 'parcela' OR NEW.numero <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_total_parcelas
  FROM public.parcelas
  WHERE matricula_id = NEW.matricula_id
    AND tipo = 'parcela';

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

  IF v_total_parcelas > 1 THEN
    v_tipo_pag := 'boleto';
    v_valor := v_com_parcelado;
  ELSE
    v_tipo_pag := 'avista';
    v_valor := v_com_avista;
  END IF;

  v_competencia := date_trunc('month', COALESCE(NEW.data_pagamento, CURRENT_DATE))::date;

  INSERT INTO public.comissoes (
    vendedora, aluno_id, matricula_id, tipo_pagamento, valor, competencia, status
  ) VALUES (
    v_vendedora, v_aluno_id, NEW.matricula_id, v_tipo_pag, v_valor, v_competencia, 'pendente'
  )
  ON CONFLICT (matricula_id, tipo_pagamento) WHERE estornado = false DO NOTHING;

  RETURN NEW;
END;
$function$;
