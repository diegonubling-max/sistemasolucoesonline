ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;

-- Exemplo de política, deve ser ajustada conforme a lógica atual do projeto:
CREATE POLICY "Acesso autenticado" ON public.matriculas FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso autenticado" ON public.parcelas FOR ALL TO authenticated USING (true);
