INSERT INTO public.configuracoes 
  (chave, valor, descricao) VALUES
('asaas_api_key', '', 'Chave de API do Asaas'),
('asaas_ambiente', 'producao', 'Ambiente do Asaas: producao ou sandbox')
ON CONFLICT (chave) DO NOTHING;