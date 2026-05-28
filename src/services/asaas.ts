import { supabase } from "@/integrations/supabase/client";

export const generateAsaasCobrar = async (parcelaId: string, tipo: 'PIX' | 'BOLETO' | null = null, action: 'create' | 'fetch' = 'create') => {
  const { data, error } = await supabase.functions.invoke('asaas-cobrar', {
    body: { parcela_id: parcelaId, tipo, action }
  });

  if (error) {
    console.error('Erro ao gerar cobrança via Edge Function:', error);
    throw new Error(error.message || 'Erro ao gerar cobrança no Asaas');
  }

  return data;
};

// Mantendo para compatibilidade ou se necessário para outras partes do sistema
// Mas recomendando o uso da Edge Function asaas-cobrar
export const asaasRequest = async (path: string, options: any = {}) => {
  // Se asaas-api não existe, isso vai falhar. 
  // O usuário disse que só existe asaas-webhook e manage-student-access.
  const { data, error } = await supabase.functions.invoke('asaas-api', {
    body: {
      path,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : undefined
    }
  });

  if (error) {
    throw new Error(error.message || 'Erro na comunicação com o servidor de pagamentos');
  }

  return data;
};

export const createOrGetAsaasCustomer = async (aluno: { nome: string; cpf: string; email: string; telefone: string; id: string }) => {
  // Note: This still relies on asaas-api which might not exist.
  // Ideally, we should migrate everything to edge functions or a single gateway.
  try {
    const existing = await asaasRequest(`/customers?cpfCnpj=${aluno.cpf.replace(/\D/g, '')}`);
    if (existing.totalCount > 0) {
      const customerId = existing.data[0].id;
      await supabase.from('alunos').update({ asaas_customer_id: customerId }).eq('id', aluno.id);
      return customerId;
    }

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
