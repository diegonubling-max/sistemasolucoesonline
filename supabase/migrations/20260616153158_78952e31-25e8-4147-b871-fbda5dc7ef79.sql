
-- Geração automática de comissões ao pagar parcelas
-- Regras: Cartão/PIX => R$120, Boleto (1ª parcela) => R$50.
-- Taxa de matrícula nunca gera comissão.
-- Idempotência: 1 comissão (não-estornada) por matricula + tipo_pagamento.

CREATE UNIQUE INDEX IF NOT EXISTS comissoes_unique_matricula_tipo_active
  ON public.comissoes (matricula_id, tipo_pagamento)
  WHERE estornado = false;

CREATE INDEX IF NOT EXISTS comissoes_competencia_idx ON public.comissoes (competencia);
CREATE INDEX IF NOT EXISTS comissoes_vendedora_idx ON public.comissoes (vendedora);

GRANT SELECT, INSERT, UPDATE ON public.comissoes TO authenticated;
GRANT ALL ON public.comissoes TO service_role;

CREATE OR REPLACE FUNCTION public.gerar_comissao_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaborador_id uuid;
  v_aluno_id uuid;
  v_vendedora text;
  v_tipo_pag text;
  v_valor numeric(10,2);
  v_competencia date;
BEGIN
  -- Só dispara em transição para "pago"
  IF NEW.status <> 'pago' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Taxa de matrícula nunca gera comissão
  IF NEW.tipo = 'taxa_matricula' THEN
    RETURN NEW;
  END IF;

  -- Vendedora vem da matrícula
  SELECT m.colaborador_id, m.aluno_id INTO v_colaborador_id, v_aluno_id
  FROM public.matriculas m WHERE m.id = NEW.matricula_id;

  IF v_colaborador_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_vendedora FROM public.colaboradores WHERE id = v_colaborador_id;
  IF v_vendedora IS NULL THEN
    RETURN NEW;
  END IF;

  -- Regras
  IF NEW.forma_pagamento IN ('cartao', 'pix') THEN
    v_tipo_pag := CASE WHEN NEW.forma_pagamento = 'cartao' THEN 'cartao' ELSE 'avista' END;
    v_valor := 120.00;
  ELSIF NEW.forma_pagamento = 'boleto' AND NEW.tipo = 'parcela' AND NEW.numero = 1 THEN
    v_tipo_pag := 'boleto';
    v_valor := 50.00;
  ELSE
    RETURN NEW;
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
$$;

DROP TRIGGER IF EXISTS trg_gerar_comissao_pagamento ON public.parcelas;
CREATE TRIGGER trg_gerar_comissao_pagamento
AFTER UPDATE OF status ON public.parcelas
FOR EACH ROW
EXECUTE FUNCTION public.gerar_comissao_pagamento();
