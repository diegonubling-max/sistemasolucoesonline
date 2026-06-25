
-- 1) milhas_eja
CREATE TABLE IF NOT EXISTS public.milhas_eja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  pontos_total integer NOT NULL DEFAULT 0,
  pontos_disponiveis integer NOT NULL DEFAULT 0,
  nivel text NOT NULL DEFAULT '🌱 Iniciante',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aluno_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milhas_eja TO authenticated;
GRANT ALL ON public.milhas_eja TO service_role;
ALTER TABLE public.milhas_eja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam milhas" ON public.milhas_eja
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Aluno vê suas milhas" ON public.milhas_eja
  FOR SELECT TO authenticated
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')));

-- 2) milhas_eja_historico
CREATE TABLE IF NOT EXISTS public.milhas_eja_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  pontos integer NOT NULL,
  tipo text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_milhas_hist_aluno ON public.milhas_eja_historico(aluno_id, created_at DESC);
GRANT SELECT, INSERT ON public.milhas_eja_historico TO authenticated;
GRANT ALL ON public.milhas_eja_historico TO service_role;
ALTER TABLE public.milhas_eja_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem histórico" ON public.milhas_eja_historico
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Aluno vê seu histórico" ON public.milhas_eja_historico
  FOR SELECT TO authenticated
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')));
CREATE POLICY "Aluno cria seu histórico" ON public.milhas_eja_historico
  FOR INSERT TO authenticated
  WITH CHECK (aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')));

-- 3) milhas_eja_controle
CREATE TABLE IF NOT EXISTS public.milhas_eja_controle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  referencia_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, tipo, referencia_id)
);
GRANT SELECT, INSERT ON public.milhas_eja_controle TO authenticated;
GRANT ALL ON public.milhas_eja_controle TO service_role;
ALTER TABLE public.milhas_eja_controle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem controle" ON public.milhas_eja_controle
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Aluno vê seu controle" ON public.milhas_eja_controle
  FOR SELECT TO authenticated
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')));
CREATE POLICY "Aluno insere seu controle" ON public.milhas_eja_controle
  FOR INSERT TO authenticated
  WITH CHECK (aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')));

-- updated_at
DROP TRIGGER IF EXISTS trg_milhas_eja_updated ON public.milhas_eja;
CREATE TRIGGER trg_milhas_eja_updated
  BEFORE UPDATE ON public.milhas_eja
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) função nível
CREATE OR REPLACE FUNCTION public.calc_nivel_milhas(p_pontos integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_pontos >= 1201 THEN '🏆 Destaque'
    WHEN p_pontos >= 701  THEN '⭐ Dedicado'
    WHEN p_pontos >= 451  THEN '📚 Estudante'
    ELSE '🌱 Iniciante'
  END
$$;

-- 5) add_milhas_eja
CREATE OR REPLACE FUNCTION public.add_milhas_eja(
  p_aluno_id uuid,
  p_pontos integer,
  p_tipo text,
  p_descricao text DEFAULT NULL,
  p_referencia_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
  v_total integer;
BEGIN
  BEGIN
    INSERT INTO public.milhas_eja_controle (aluno_id, tipo, referencia_id)
    VALUES (p_aluno_id, p_tipo, COALESCE(p_referencia_id, ''));
    v_inserted := true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;

  INSERT INTO public.milhas_eja_historico (aluno_id, pontos, tipo, descricao)
  VALUES (p_aluno_id, p_pontos, p_tipo, p_descricao);

  INSERT INTO public.milhas_eja (aluno_id, pontos_total, pontos_disponiveis, nivel)
  VALUES (p_aluno_id, p_pontos, p_pontos, public.calc_nivel_milhas(p_pontos))
  ON CONFLICT (aluno_id) DO UPDATE
    SET pontos_total = public.milhas_eja.pontos_total + EXCLUDED.pontos_total,
        pontos_disponiveis = public.milhas_eja.pontos_disponiveis + EXCLUDED.pontos_disponiveis,
        nivel = public.calc_nivel_milhas(public.milhas_eja.pontos_total + EXCLUDED.pontos_total),
        updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_milhas_eja(uuid,integer,text,text,text) TO authenticated, service_role;

-- 6) check_7_dias_login_milhas — chama add_milhas_eja se houver sequência de 7 dias
CREATE OR REPLACE FUNCTION public.check_7_dias_login_milhas(p_aluno_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias date[];
  v_seq integer := 1;
  v_ref text;
  v_creditou boolean := false;
  i integer;
BEGIN
  SELECT array_agg(d ORDER BY d DESC) INTO v_dias FROM (
    SELECT DISTINCT (login_em AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.aluno_sessoes
    WHERE aluno_id = p_aluno_id
    ORDER BY 1 DESC
    LIMIT 30
  ) t;

  IF v_dias IS NULL OR array_length(v_dias,1) < 7 THEN
    RETURN false;
  END IF;

  -- Verifica sequência terminando no dia mais recente
  FOR i IN 1..LEAST(array_length(v_dias,1)-1, 29) LOOP
    IF v_dias[i] - v_dias[i+1] = 1 THEN
      v_seq := v_seq + 1;
      IF v_seq >= 7 THEN
        v_ref := v_dias[i+1]::text || '_' || v_dias[i-5]::text;
        SELECT public.add_milhas_eja(p_aluno_id, 150, '7_dias_login',
          '7 dias seguidos de login', v_ref) INTO v_creditou;
        RETURN v_creditou;
      END IF;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_7_dias_login_milhas(uuid) TO authenticated, service_role;

-- 7) Inicializar alunos ativos
INSERT INTO public.milhas_eja (aluno_id, pontos_total, pontos_disponiveis, nivel)
SELECT id, 0, 0, '🌱 Iniciante'
FROM public.alunos
WHERE ativo = true
  AND id NOT IN (SELECT aluno_id FROM public.milhas_eja)
ON CONFLICT (aluno_id) DO NOTHING;
