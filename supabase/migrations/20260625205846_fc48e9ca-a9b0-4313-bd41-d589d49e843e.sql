
CREATE TABLE IF NOT EXISTS public.vitrine_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id),
  vitrine_id uuid REFERENCES public.cursos_vitrine(id),
  asaas_payment_id text,
  asaas_invoice_url text,
  asaas_pix_payload text,
  asaas_pix_qrcode text,
  forma_pagamento text NOT NULL,
  parcelas integer DEFAULT 1,
  valor_total numeric(10,2) NOT NULL,
  valor_parcela numeric(10,2),
  status text NOT NULL DEFAULT 'pendente',
  usou_pontos boolean DEFAULT false,
  pontos_usados integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.vitrine_compras TO authenticated;
GRANT ALL ON public.vitrine_compras TO service_role;

ALTER TABLE public.vitrine_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno vê suas compras"
  ON public.vitrine_compras FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = vitrine_compras.aluno_id AND a.email = auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Aluno cria suas compras"
  ON public.vitrine_compras FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = vitrine_compras.aluno_id AND a.email = auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin atualiza compras"
  ON public.vitrine_compras FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_vitrine_compras_aluno ON public.vitrine_compras(aluno_id);
CREATE INDEX IF NOT EXISTS idx_vitrine_compras_payment ON public.vitrine_compras(asaas_payment_id);

CREATE TRIGGER trg_vitrine_compras_updated
  BEFORE UPDATE ON public.vitrine_compras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para liberar curso após confirmação de pagamento (webhook)
CREATE OR REPLACE FUNCTION public.liberar_curso_vitrine_pago(p_compra_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id uuid;
  v_curso_id uuid;
  v_vitrine_id uuid;
  v_polo_id uuid;
  v_status text;
  v_matricula_id uuid;
BEGIN
  SELECT aluno_id, curso_id, vitrine_id, status
    INTO v_aluno_id, v_curso_id, v_vitrine_id, v_status
    FROM public.vitrine_compras
   WHERE id = p_compra_id
   FOR UPDATE;

  IF v_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Compra não encontrada';
  END IF;

  IF v_status = 'pago' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT polo_id INTO v_polo_id FROM public.alunos WHERE id = v_aluno_id;

  INSERT INTO public.matriculas (aluno_id, polo_id, observacao)
  VALUES (v_aluno_id, v_polo_id, 'Compra na vitrine (Asaas)')
  RETURNING id INTO v_matricula_id;

  INSERT INTO public.matricula_cursos (matricula_id, curso_id)
  VALUES (v_matricula_id, v_curso_id);

  UPDATE public.vitrine_compras
     SET status = 'pago', paid_at = now()
   WHERE id = p_compra_id;

  IF v_vitrine_id IS NOT NULL THEN
    UPDATE public.cursos_vitrine
       SET ativo = false
     WHERE id = v_vitrine_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'matricula_id', v_matricula_id);
END;
$$;
