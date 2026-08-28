import { supabase } from "@/integrations/supabase/client";

export const cancelarCobrancaAsaas = async (parcelaId: string) => {
  const { data, error } = await supabase.functions.invoke('asaas-cobrar', {
    body: { parcela_id: parcelaId, action: 'cancel' }
  });
  if (error) {
    let mensagemReal = error.message || 'Erro ao cancelar cobrança no Asaas';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const corpo = await error.context.json();
        if (corpo?.error) mensagemReal = corpo.error;
      }
    } catch {
      // corpo não era JSON ou já foi consumido — mantém a mensagem genérica
    }
    throw new Error(mensagemReal);
  }
  return data;
};

export const generateAsaasCobrar = async (parcelaId: string, tipo: 'PIX' | 'BOLETO' | null = null, action: 'create' | 'fetch' = 'create') => {
  const { data, error } = await supabase.functions.invoke('asaas-cobrar', {
    body: { parcela_id: parcelaId, tipo, action }
  });

  if (error) {
    console.error('Erro ao gerar cobrança via Edge Function:', error);
    // O supabase-js só dá uma mensagem genérica ("Edge Function returned a non-2xx status
    // code") por padrão — o motivo real do erro (ex: problema com o cadastro do aluno no
    // Asaas, chave da API do polo, etc) vem no corpo da resposta, em error.context.
    // Sem isso, o usuário só vê a mensagem genérica e não sabe o que de fato aconteceu.
    let mensagemReal = error.message || 'Erro ao gerar cobrança no Asaas';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const corpo = await error.context.json();
        if (corpo?.error) mensagemReal = corpo.error;
      }
    } catch {
      // corpo não era JSON ou já foi consumido — mantém a mensagem genérica
    }
    throw new Error(mensagemReal);
  }

  return data;
};

/**
 * Confirma no Asaas que a parcela foi paga em dinheiro/manualmente,
 * fazendo o Asaas parar de enviar cobranças por email/SMS.
 * Seguro chamar sempre após uma baixa: a edge function pula se não houver asaas_id.
 */
export const confirmarPagamentoAsaas = async (
  parcelaId: string,
  valor: number,
  dataPagamento: string
) => {
  try {
    const { data, error } = await supabase.functions.invoke('asaas-cobrar', {
      body: {
        parcela_id: parcelaId,
        action: 'receive_in_cash',
        value: valor,
        paymentDate: dataPagamento,
      },
    });
    if (error) {
      console.error('Erro ao confirmar pagamento no Asaas:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Falha ao confirmar pagamento no Asaas:', err);
    return null;
  }
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
