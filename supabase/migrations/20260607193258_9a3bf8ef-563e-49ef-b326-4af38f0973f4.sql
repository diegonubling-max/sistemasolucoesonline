-- Add configuration columns to polos table
ALTER TABLE public.polos 
ADD COLUMN IF NOT EXISTS asaas_api_key TEXT,
ADD COLUMN IF NOT EXISTS asaas_ambiente TEXT DEFAULT 'producao',
ADD COLUMN IF NOT EXISTS asaas_webhook_token TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS nome_escola TEXT;

-- Comment for documentation
COMMENT ON COLUMN public.polos.asaas_api_key IS 'Chave de API do Asaas para este polo';
COMMENT ON COLUMN public.polos.asaas_ambiente IS 'Ambiente do Asaas (producao ou sandbox) para este polo';
COMMENT ON COLUMN public.polos.asaas_webhook_token IS 'Token do webhook do Asaas para este polo';
COMMENT ON COLUMN public.polos.whatsapp IS 'Número de WhatsApp de suporte para este polo';
COMMENT ON COLUMN public.polos.logo_url IS 'URL do logotipo da escola para este polo';
COMMENT ON COLUMN public.polos.nome_escola IS 'Nome da escola para este polo';
