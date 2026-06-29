ALTER TABLE public.cursos_vitrine
  ADD COLUMN IF NOT EXISTS valor_pix numeric(10,2),
  ADD COLUMN IF NOT EXISTS valor_cartao numeric(10,2),
  ADD COLUMN IF NOT EXISTS valor_pix_desconto numeric(10,2),
  ADD COLUMN IF NOT EXISTS valor_cartao_desconto numeric(10,2),
  ADD COLUMN IF NOT EXISTS pontos_desconto integer;