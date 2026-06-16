
-- Enable RLS and policies on banners_polo
ALTER TABLE public.banners_polo ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners_polo TO authenticated;
GRANT SELECT ON public.banners_polo TO anon;
GRANT ALL ON public.banners_polo TO service_role;

-- Anyone authenticated can read active banners (students need this)
CREATE POLICY "Banners visíveis a autenticados"
ON public.banners_polo FOR SELECT
TO authenticated
USING (true);

-- Admins gerenciam tudo
CREATE POLICY "Admin gerencia banners"
ON public.banners_polo FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Colaboradores do polo gerenciam banners do seu polo
CREATE POLICY "Colaborador do polo gerencia banners"
ON public.banners_polo FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.colaboradores c
    WHERE c.user_id = auth.uid()
      AND c.polo_id = banners_polo.polo_id
      AND c.ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.colaboradores c
    WHERE c.user_id = auth.uid()
      AND c.polo_id = banners_polo.polo_id
      AND c.ativo = true
  )
);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_banners_polo_updated_at ON public.banners_polo;
CREATE TRIGGER trg_banners_polo_updated_at
BEFORE UPDATE ON public.banners_polo
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
