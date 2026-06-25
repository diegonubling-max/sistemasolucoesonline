DROP POLICY IF EXISTS "Service role insere logs" ON public.zapi_mensagens_log;

GRANT INSERT ON public.zapi_mensagens_log TO anon;

CREATE POLICY "Qualquer um insere logs zapi"
  ON public.zapi_mensagens_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
