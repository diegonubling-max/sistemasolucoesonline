CREATE TABLE IF NOT EXISTS public.zapi_mensagens_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'enviado',
  erro_detalhe text,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zapi_mensagens_log_aluno ON public.zapi_mensagens_log(aluno_id, enviado_em DESC);

GRANT SELECT, INSERT ON public.zapi_mensagens_log TO authenticated;
GRANT ALL ON public.zapi_mensagens_log TO service_role;

ALTER TABLE public.zapi_mensagens_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs zapi"
  ON public.zapi_mensagens_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role insere logs"
  ON public.zapi_mensagens_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
