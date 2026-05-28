INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES ('asaas_webhook_token', '', 'Token de segurança para validação do webhook do Asaas')
ON CONFLICT (chave) DO NOTHING;