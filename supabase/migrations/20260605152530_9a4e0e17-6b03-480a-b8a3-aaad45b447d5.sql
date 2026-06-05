
-- 1. Enable RLS on all public tables missing it
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matricula_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matricula_pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segmentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. modelos_contrato admin-only policy (table had no policies)
CREATE POLICY "Admins manage modelos_contrato" ON public.modelos_contrato
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Replace overly permissive (true/true) policies
DROP POLICY IF EXISTS "Admins can manage showcase" ON public.cursos_vitrine;
DROP POLICY IF EXISTS "Admins can manage segments" ON public.segmentos;
CREATE POLICY "Admins manage segmentos" ON public.segmentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Manage leads_diarios" ON public.leads_diarios;
CREATE POLICY "Admins manage leads_diarios" ON public.leads_diarios
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Lock down configuracoes — keep admins-only (drop authenticated-wide read)
DROP POLICY IF EXISTS "Authenticated users can view configurations" ON public.configuracoes;

-- 5. perfis_alunos: drop student SELECT that exposed senha column
DROP POLICY IF EXISTS "Students view own details" ON public.perfis_alunos;

-- 6. Contratos: remove broad anon access, expose via SECURITY DEFINER RPCs scoped to a known token
DROP POLICY IF EXISTS "Anyone can view contract by token" ON public.contratos;
DROP POLICY IF EXISTS "Anyone can update contract by token for signature" ON public.contratos;

-- 7. Alunos: drop policy that exposed every student row to anon
DROP POLICY IF EXISTS "Anyone can view student name for contract" ON public.alunos;

-- 8. Public RPCs for contract page (anon, must know the token)
CREATE OR REPLACE FUNCTION public.get_contrato_publico(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'token_unico', c.token_unico,
    'status', c.status,
    'conteudo_html', c.conteudo_html,
    'aluno_id', c.aluno_id,
    'matricula_id', c.matricula_id,
    'data_assinatura', c.data_assinatura,
    'nome_confirmacao', c.nome_confirmacao,
    'ip_assinatura', c.ip_assinatura,
    'created_at', c.created_at,
    'alunos', jsonb_build_object(
      'id', a.id,
      'nome', a.nome,
      'telefone', a.telefone,
      'cpf', a.cpf
    )
  )
  INTO result
  FROM public.contratos c
  LEFT JOIN public.alunos a ON a.id = c.aluno_id
  WHERE c.token_unico = p_token;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_contrato_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contrato_publico(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.assinar_contrato_publico(p_token uuid, p_nome text, p_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contratos
  SET status = 'assinado',
      data_assinatura = now(),
      ip_assinatura = p_ip,
      nome_confirmacao = p_nome
  WHERE token_unico = p_token AND status = 'pendente';
END;
$$;
REVOKE ALL ON FUNCTION public.assinar_contrato_publico(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinar_contrato_publico(uuid, text, text) TO anon, authenticated;

-- 9. Storage: restrict thumbnails write to admins
DROP POLICY IF EXISTS "Admin pode inserir thumbnails de aulas" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode atualizar thumbnails de aulas" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode deletar thumbnails de aulas" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode inserir thumbnails de cursos" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode atualizar thumbnails de cursos" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode deletar thumbnails de cursos" ON storage.objects;

CREATE POLICY "Admins insert thumbnails aulas" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails-aulas' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update thumbnails aulas" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'thumbnails-aulas' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete thumbnails aulas" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'thumbnails-aulas' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert thumbnails cursos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails-cursos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update thumbnails cursos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'thumbnails-cursos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete thumbnails cursos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'thumbnails-cursos' AND public.has_role(auth.uid(), 'admin'));

-- 10. Restrict bucket listing (public URLs still work for public buckets via CDN)
DROP POLICY IF EXISTS "Thumbnails de aulas são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Thumbnails de cursos são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Admins list thumbnails aulas" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'thumbnails-aulas' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins list thumbnails cursos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'thumbnails-cursos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins list fotos perfil" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-perfil' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users list own fotos perfil" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-perfil' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 11. Function with mutable search_path
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 12. Revoke SECURITY DEFINER admin/internal functions from anon
REVOKE EXECUTE ON FUNCTION public.criar_acesso_aluno(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_auth(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_pacote(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redefinir_senha_aluno(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_aluno_completo(uuid) FROM PUBLIC, anon;
