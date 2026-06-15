CREATE TABLE public.vitrine_cliques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  polo_id uuid REFERENCES public.polos(id) ON DELETE SET NULL,
  clicado_em timestamptz NOT NULL DEFAULT now(),
  clicado_dia date GENERATED ALWAYS AS ((clicado_em AT TIME ZONE 'UTC')::date) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitrine_cliques TO authenticated;
GRANT ALL ON public.vitrine_cliques TO service_role;

CREATE INDEX idx_vitrine_cliques_clicado_em ON public.vitrine_cliques(clicado_em DESC);
CREATE INDEX idx_vitrine_cliques_polo ON public.vitrine_cliques(polo_id);
CREATE UNIQUE INDEX uniq_vitrine_cliques_dia ON public.vitrine_cliques(aluno_id, curso_id, clicado_dia);