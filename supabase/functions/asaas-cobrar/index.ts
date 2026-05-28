import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando processamento de cobrança...");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { parcela_id, tipo } = body;
    console.log(`Recebido: parcela_id=${parcela_id}, tipo=${tipo}`);

    if (!parcela_id || !tipo) {
      throw new Error("ID da parcela e tipo são obrigatórios.");
    }

    // 2. Buscar configurações do Asaas
    console.log("Buscando configurações do Asaas...");
    const { data: configs, error: configError } = await supabaseClient
      .from("configuracoes")
      .select("chave, valor");

    if (configError) {
      console.error("Erro ao buscar configurações:", configError);
      throw configError;
    }

    const asaas_api_key = configs.find(c => c.chave === "asaas_api_key")?.valor;
    const asaas_ambiente = configs.find(c => c.chave === "asaas_ambiente")?.valor || "sandbox";

    if (!asaas_api_key) {
      console.error("Chave de API do Asaas não encontrada na tabela configuracoes.");
      throw new Error("Chave de API do Asaas não configurada.");
    }

    console.log(`Ambiente: ${asaas_ambiente}`);

    const asaasBaseUrl = asaas_ambiente === "producao" 
      ? "https://www.asaas.com/api/v3" 
      : "https://sandbox.asaas.com/api/v3";

    console.log(`URL Base Asaas: ${asaasBaseUrl}`);

    // 3. Buscar dados da parcela e do aluno
    console.log("Buscando dados da parcela e aluno...");
    const { data: parcela, error: parcelaError } = await supabaseClient
      .from("parcelas")
      .select(`
        *,
        matriculas (
          aluno_id,
          alunos (*)
        )
      `)
      .eq("id", parcela_id)
      .single();

    if (parcelaError || !parcela) {
      console.error("Erro ao buscar parcela:", parcelaError);
      throw new Error("Parcela não encontrada.");
    }

    console.log("Dados da parcela encontrados:", JSON.stringify({
      id: parcela.id,
      valor: parcela.valor,
      data_vencimento: parcela.data_vencimento,
      matricula_id: parcela.matricula_id
    }));

    const matricula = parcela.matriculas;
    const aluno = Array.isArray(matricula) ? matricula[0]?.alunos : matricula?.alunos;

    if (!aluno) {
      console.error("Aluno não encontrado para a parcela", parcela_id, "Estrutura matriculas:", JSON.stringify(matricula));
      throw new Error("Aluno não encontrado para esta parcela. Verifique o vínculo da matrícula.");
    }

    let asaas_customer_id = aluno.asaas_customer_id;

    // 4. Se não tiver asaas_customer_id, criar cliente
    if (!asaas_customer_id) {
      console.log(`Aluno ${aluno.nome} sem ID Asaas. Tentando criar cliente...`);
      
      if (!aluno.cpf || !aluno.nome || !aluno.email) {
        const missing = [];
        if (!aluno.nome) missing.push("Nome");
        if (!aluno.cpf) missing.push("CPF");
        if (!aluno.email) missing.push("E-mail");
        throw new Error(`Cadastro do aluno incompleto: ${missing.join(", ")} são obrigatórios.`);
      }

      const customerPayload = {
        name: aluno.nome,
        cpfCnpj: aluno.cpf.replace(/\D/g, ''),
        email: aluno.email,
        phone: aluno.telefone?.replace(/\D/g, ''),
        externalReference: aluno.id,
        notificationDisabled: true
      };

      console.log("Payload criação cliente:", JSON.stringify(customerPayload));
      
      const customerResponse = await fetch(`${asaasBaseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaas_api_key
        },
        body: JSON.stringify(customerPayload)
      });

      const customerData = await customerResponse.json();
      console.log("Resposta criação cliente:", JSON.stringify(customerData));

      if (!customerResponse.ok) {
        throw new Error(`Erro ao criar cliente no Asaas: ${customerData.errors?.[0]?.description || customerResponse.statusText}`);
      }

      asaas_customer_id = customerData.id;
      console.log(`Cliente criado com sucesso. ID Asaas: ${asaas_customer_id}`);

      // Salvar asaas_customer_id no banco
      const { error: updateAlunoError } = await supabaseClient
        .from("alunos")
        .update({ asaas_customer_id })
        .eq("id", aluno.id);

      if (updateAlunoError) {
        console.error("Erro ao salvar asaas_customer_id no banco:", updateAlunoError);
      }
    } else {
      console.log(`Aluno já possui ID Asaas: ${asaas_customer_id}`);
    }

    // 5. Preparar data de vencimento (Asaas exige YYYY-MM-DD)
    let dueDate = parcela.data_vencimento;
    if (dueDate && dueDate.includes('T')) {
      dueDate = dueDate.split('T')[0];
    }

    // 5. Criar cobrança no Asaas
    console.log(`Gerando cobrança ${tipo} para parcela ${parcela_id} no valor de ${parcela.valor} e vencimento ${dueDate}`);
    
    const paymentPayload = {
      customer: asaas_customer_id,
      billingType: tipo === 'PIX' ? 'PIX' : 'BOLETO',
      value: Number(parcela.valor),
      dueDate: dueDate,
      description: parcela.descricao || `Parcela ${parcela.numero || ''}`,
      externalReference: parcela.id,
    };

    console.log("Payload cobrança:", JSON.stringify(paymentPayload));

    const paymentResponse = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaas_api_key
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentResponse.json();
    console.log("RESPOSTA COMPLETA ASAAS:", JSON.stringify(paymentData, null, 2));

    if (!paymentResponse.ok) {
      throw new Error(`Erro ao criar cobrança no Asaas: ${paymentData.errors?.[0]?.description || paymentResponse.statusText}`);
    }

    // 6. Buscar QR Code se for PIX
    let pixData = null;
    if (tipo === 'PIX') {
      console.log(`Buscando QR Code PIX para pagamento ${paymentData.id}...`);
      const pixResponse = await fetch(`${asaasBaseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { "access_token": asaas_api_key }
      });
      pixData = await pixResponse.json();
      console.log("Resposta QR Code PIX recebida.");
    }

    // 7. Atualizar a parcela com os dados do Asaas
    console.log("Atualizando parcela no banco de dados...");
    const updateParcela: any = {
      asaas_id: paymentData.id,
      asaas_url: paymentData.bankSlipUrl || paymentData.invoiceUrl,
      forma_pagamento: tipo.toLowerCase()
    };

    if (tipo === 'PIX' && pixData) {
      updateParcela.asaas_pix_chave = pixData.payload;
      updateParcela.asaas_pix_qrcode = pixData.encodedImage;
    } else if (tipo === 'BOLETO') {
      // Priorizando identificationField (linha digitável de 47 dígitos) conforme solicitado
      updateParcela.asaas_barcode = paymentData.identificationField || paymentData.fullCycleCode || paymentData.nossoNumero;
    }

    const { error: updateParcelaError } = await supabaseClient
      .from("parcelas")
      .update(updateParcela)
      .eq("id", parcela_id);

    if (updateParcelaError) {
      console.error("Erro ao atualizar parcela no banco:", updateParcelaError);
      throw updateParcelaError;
    }

    console.log("Processo concluído com sucesso!");

    return new Response(JSON.stringify({ 
      success: true, 
      payment: paymentData, 
      pixData,
      updateParcela 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("ERRO FATAL na function asaas-cobrar:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});