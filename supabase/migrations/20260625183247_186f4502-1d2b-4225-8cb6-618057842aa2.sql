
CREATE TABLE IF NOT EXISTS public.zapi_disparos_controle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo_disparo text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, tipo_disparo)
);

CREATE INDEX IF NOT EXISTS idx_zapi_disparos_aluno ON public.zapi_disparos_controle(aluno_id);

GRANT SELECT ON public.zapi_disparos_controle TO authenticated;
GRANT ALL ON public.zapi_disparos_controle TO service_role;

ALTER TABLE public.zapi_disparos_controle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem disparos"
  ON public.zapi_disparos_controle FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
