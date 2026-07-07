
CREATE OR REPLACE FUNCTION public.registrar_pagamento_parcela(
  p_parcela_id uuid,
  p_valor_pago numeric,
  p_data_pagamento date,
  p_forma_pagamento text,
  p_parcelas_cartao integer DEFAULT NULL,
  p_taxa_cartao numeric DEFAULT NULL,
  p_valor_liquido numeric DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor numeric;
  v_pago_atual numeric;
  v_novo_total numeric;
  v_restante numeric;
  v_status payment_status;
BEGIN
  SELECT valor, COALESCE(valor_pago_total, 0)
    INTO v_valor, v_pago_atual
  FROM public.parcelas
  WHERE id = p_parcela_id
  FOR UPDATE;

  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  v_restante := v_valor - v_pago_atual;
  IF p_valor_pago <= 0 THEN
    RAISE EXCEPTION 'Valor pago deve ser maior que zero';
  END IF;
  IF p_valor_pago > v_restante + 0.001 THEN
    RAISE EXCEPTION 'Valor pago (%) maior que o saldo restante (%)', p_valor_pago, v_restante;
  END IF;

  v_novo_total := v_pago_atual + p_valor_pago;

  IF v_novo_total >= v_valor - 0.001 THEN
    -- Baixa total: só registra histórico se já havia pagamento parcial anterior
    IF v_pago_atual > 0.001 THEN
      INSERT INTO public.parcelas_pagamentos (parcela_id, valor_pago, data_pagamento, forma_pagamento, observacao)
      VALUES (p_parcela_id, p_valor_pago, p_data_pagamento, p_forma_pagamento, p_observacao);
    END IF;

    v_status := 'pago';
    UPDATE public.parcelas
       SET valor_pago_total = v_novo_total,
           status = v_status,
           data_pagamento = p_data_pagamento,
           forma_pagamento = p_forma_pagamento,
           parcelas_cartao = COALESCE(p_parcelas_cartao, parcelas_cartao),
           taxa_cartao = COALESCE(p_taxa_cartao, taxa_cartao),
           valor_liquido = COALESCE(p_valor_liquido, valor_liquido)
     WHERE id = p_parcela_id;
  ELSE
    -- Pagamento parcial: sempre registra histórico
    INSERT INTO public.parcelas_pagamentos (parcela_id, valor_pago, data_pagamento, forma_pagamento, observacao)
    VALUES (p_parcela_id, p_valor_pago, p_data_pagamento, p_forma_pagamento, p_observacao);

    v_status := 'parcial';
    UPDATE public.parcelas
       SET valor_pago_total = v_novo_total,
           status = v_status
     WHERE id = p_parcela_id;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'valor_pago_total', v_novo_total,
    'restante', v_valor - v_novo_total
  );
END;
$$;
