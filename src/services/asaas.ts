import { supabase } from "@/integrations/supabase/client";

export const getAsaasConfig = async () => {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['asaas_api_key', 'asaas_ambiente']);
  
  if (error) {
    console.error('Erro ao buscar configurações do Asaas:', error);
    throw new Error('Falha ao carregar configurações de pagamento.');
  }

  const config = Object.fromEntries(
    data.map(d => [d.chave, d.valor])
  );
  
  const baseUrl = config.asaas_ambiente === 'sandbox' 
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/api/v3';
    
  return { apiKey: config.asaas_api_key, baseUrl };
};

export const asaasRequest = async (path: string, options: RequestInit = {}) => {
  const { apiKey, baseUrl } = await getAsaasConfig();
  
  if (!apiKey) {
    throw new Error('Chave de API do Asaas não configurada.');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ errors: [{ description: 'Erro desconhecido na API do Asaas' }] }));
    throw new Error(errorData.errors?.[0]?.description || 'Erro na requisição ao Asaas');
  }

  return response.json();
};

export const createOrGetAsaasCustomer = async (aluno: { nome: string; cpf: string; email: string; telefone: string; id: string }) => {
  try {
    // Primeiro tenta buscar por CPF
    const existing = await asaasRequest(`/customers?cpfCnpj=${aluno.cpf.replace(/\D/g, '')}`);
    if (existing.totalCount > 0) {
      const customerId = existing.data[0].id;
      await supabase.from('alunos').update({ asaas_customer_id: customerId }).eq('id', aluno.id);
      return customerId;
    }

    // Se não existir, cria
    const customer = await asaasRequest('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: aluno.nome,
        cpfCnpj: aluno.cpf.replace(/\D/g, ''),
        email: aluno.email,
        phone: aluno.telefone,
        notificationDisabled: false,
        externalReference: aluno.id
      }),
    });

    await supabase.from('alunos').update({ asaas_customer_id: customer.id }).eq('id', aluno.id);
    return customer.id;
  } catch (error: any) {
    console.error('Erro ao gerenciar cliente no Asaas:', error);
    throw error;
  }
};

export const createAsaasPayment = async (params: { 
  customer: string; 
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'; 
  value: number; 
  dueDate: string; 
  description: string; 
  externalReference: string;
}) => {
  const payment = await asaasRequest('/payments', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  let pixData = null;
  if (params.billingType === 'PIX') {
    pixData = await asaasRequest(`/payments/${payment.id}/pixQrCode`);
  }

  return { payment, pixData };
};
