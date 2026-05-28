import { supabase } from "@/integrations/supabase/client";

export const asaasRequest = async (path: string, options: any = {}) => {
  const { data, error } = await supabase.functions.invoke('asaas-api', {
    body: {
      path,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : undefined
    }
  });

  if (error) {
    console.error('Erro na chamada da Edge Function Asaas:', error);
    throw new Error(error.message || 'Erro na comunicação com o servidor de pagamentos');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
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
