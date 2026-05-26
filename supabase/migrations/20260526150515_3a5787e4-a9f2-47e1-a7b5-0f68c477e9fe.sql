ALTER TABLE public.parcelas 
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
ADD COLUMN IF NOT EXISTS parcelas_cartao INTEGER,
ADD COLUMN IF NOT EXISTS taxa_cartao NUMERIC,
ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC;

COMMENT ON COLUMN public.parcelas.forma_pagamento IS 'Valores: boleto, pix, cartao';
COMMENT ON COLUMN public.parcelas.parcelas_cartao IS 'Número de parcelas quando pago no cartão';
COMMENT ON COLUMN public.parcelas.taxa_cartao IS 'Percentual da taxa aplicada';
COMMENT ON COLUMN public.parcelas.valor_liquido IS 'Valor após desconto da taxa do cartão';
