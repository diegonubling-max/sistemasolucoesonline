
-- 1. Permissão ver_setor_provas
ALTER TABLE public.colaborador_permissoes
  ADD COLUMN IF NOT EXISTS ver_setor_provas boolean DEFAULT false;

-- 2. RLS + GRANTS para tabelas do Setor de Provas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificadoras TO authenticated;
GRANT ALL ON public.certificadoras TO service_role;
ALTER TABLE public.certificadoras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_certificadoras" ON public.certificadoras;
CREATE POLICY "auth_all_certificadoras" ON public.certificadoras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_documentos TO authenticated;
GRANT ALL ON public.aluno_documentos TO service_role;
ALTER TABLE public.aluno_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_aluno_documentos" ON public.aluno_documentos;
CREATE POLICY "auth_all_aluno_documentos" ON public.aluno_documentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_documentos_arquivos TO authenticated;
GRANT ALL ON public.aluno_documentos_arquivos TO service_role;
ALTER TABLE public.aluno_documentos_arquivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_aluno_documentos_arquivos" ON public.aluno_documentos_arquivos;
CREATE POLICY "auth_all_aluno_documentos_arquivos" ON public.aluno_documentos_arquivos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes TO authenticated;
GRANT ALL ON public.lotes TO service_role;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_lotes" ON public.lotes;
CREATE POLICY "auth_all_lotes" ON public.lotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lote_alunos TO authenticated;
GRANT ALL ON public.lote_alunos TO service_role;
ALTER TABLE public.lote_alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_lote_alunos" ON public.lote_alunos;
CREATE POLICY "auth_all_lote_alunos" ON public.lote_alunos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Storage policies para bucket documentos-alunos (criado via tool, privado)
DROP POLICY IF EXISTS "auth_read_documentos_alunos" ON storage.objects;
CREATE POLICY "auth_read_documentos_alunos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documentos-alunos');

DROP POLICY IF EXISTS "auth_insert_documentos_alunos" ON storage.objects;
CREATE POLICY "auth_insert_documentos_alunos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-alunos');

DROP POLICY IF EXISTS "auth_update_documentos_alunos" ON storage.objects;
CREATE POLICY "auth_update_documentos_alunos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'documentos-alunos');

DROP POLICY IF EXISTS "auth_delete_documentos_alunos" ON storage.objects;
CREATE POLICY "auth_delete_documentos_alunos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documentos-alunos');
