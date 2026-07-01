
-- Função utilitária: próximo dia útil
CREATE OR REPLACE FUNCTION public.next_business_day(p_date date)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  WHILE EXTRACT(ISODOW FROM p_date) IN (6,7) LOOP
    p_date := p_date + 1;
  END LOOP;
  RETURN p_date;
END;
$$;

-- Adiciona N dias úteis a uma data
CREATE OR REPLACE FUNCTION public.add_business_days(p_date date, p_days integer)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_date date := p_date;
  v_added integer := 0;
BEGIN
  WHILE v_added < p_days LOOP
    v_date := v_date + 1;
    IF EXTRACT(ISODOW FROM v_date) NOT IN (6,7) THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN public.next_business_day(v_date);
END;
$$;

-- Tabela pos_vendas
CREATE TABLE public.pos_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  etapa integer NOT NULL CHECK (etapa IN (1,2,3)),
  data_agendada date NOT NULL,
  data_confirmacao date,
  colaborador_id uuid REFERENCES public.colaboradores(id),
  observacao text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido','arquivado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matricula_id, etapa)
);

CREATE INDEX idx_pos_vendas_matricula ON public.pos_vendas(matricula_id);
CREATE INDEX idx_pos_vendas_aluno ON public.pos_vendas(aluno_id);
CREATE INDEX idx_pos_vendas_status ON public.pos_vendas(status);
CREATE INDEX idx_pos_vendas_data_agendada ON public.pos_vendas(data_agendada);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_vendas TO authenticated;
GRANT ALL ON public.pos_vendas TO service_role;

ALTER TABLE public.pos_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam pos_vendas"
  ON public.pos_vendas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Trigger: cria 1º PV ao criar matrícula
CREATE OR REPLACE FUNCTION public.criar_primeiro_pos_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.pos_vendas (matricula_id, aluno_id, etapa, data_agendada, status)
  VALUES (
    NEW.id,
    NEW.aluno_id,
    1,
    public.add_business_days(COALESCE(NEW.created_at::date, CURRENT_DATE), 1),
    'pendente'
  )
  ON CONFLICT (matricula_id, etapa) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_criar_primeiro_pos_venda
AFTER INSERT ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.criar_primeiro_pos_venda();

-- Trigger: ao confirmar PV, gera o próximo
CREATE OR REPLACE FUNCTION public.gerar_proximo_pos_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dias integer;
  v_prox_etapa integer;
BEGIN
  IF NEW.data_confirmacao IS NULL OR OLD.data_confirmacao IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.etapa = 1 THEN
    v_prox_etapa := 2; v_dias := 5;
  ELSIF NEW.etapa = 2 THEN
    v_prox_etapa := 3; v_dias := 15;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.pos_vendas (matricula_id, aluno_id, etapa, data_agendada, status)
  VALUES (
    NEW.matricula_id,
    NEW.aluno_id,
    v_prox_etapa,
    public.add_business_days(NEW.data_confirmacao, v_dias),
    'pendente'
  )
  ON CONFLICT (matricula_id, etapa) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_proximo_pos_venda
AFTER UPDATE OF data_confirmacao ON public.pos_vendas
FOR EACH ROW EXECUTE FUNCTION public.gerar_proximo_pos_venda();

-- Backfill: cria 1º PV para matrículas existentes que ainda não têm
INSERT INTO public.pos_vendas (matricula_id, aluno_id, etapa, data_agendada, status)
SELECT m.id, m.aluno_id, 1,
       public.add_business_days(m.created_at::date, 1),
       'pendente'
FROM public.matriculas m
LEFT JOIN public.pos_vendas pv ON pv.matricula_id = m.id AND pv.etapa = 1
WHERE pv.id IS NULL;
