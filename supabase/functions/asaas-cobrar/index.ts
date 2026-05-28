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
    const { parcela_id, tipo, action = 'create' } = body;
    console.log(`Recebido: parcela_id=${parcela_id}, tipo=${tipo}, action=${action}`);

    if (!parcela_id) {
      throw new Error("ID da parcela é obrigatório.");
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

    const asaasBaseUrl = asaas_ambiente === "producao" 
      ? "https://www.asaas.com/api/v3" 
      : "https://sandbox.asaas.com/api/v3";

    // 3. Buscar dados da parcela
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

    // SE AÇÃO FOR BUSCAR COBRANÇA EXISTENTE
    if (action === 'fetch' || (parcela.asaas_id && action !== 'create')) {
      console.log(`Buscando cobrança existente no Asaas para parcela ${parcela_id} (Asaas ID: ${parcela.asaas_id})`);
      
      if (!parcela.asaas_id) {
        throw new Error("ID da cobrança Asaas não encontrado para esta parcela.");
      }

      const fetchResponse = await fetch(`${asaasBaseUrl}/payments/${parcela.asaas_id}`, {
        headers: { "access_token": asaas_api_key }
      });

      const paymentData = await fetchResponse.json();
      console.log("RETORNO ASAAS (FETCH):", JSON.stringify(paymentData));

      if (!fetchResponse.ok) {
        throw new Error(`Erro ao buscar cobrança no Asaas: ${paymentData.errors?.[0]?.description || fetchResponse.statusText}`);
      }

      // Atualizar no banco com os dados mais recentes (especialmente identificationField)
      const updateData: any = {
        asaas_url: paymentData.bankSlipUrl || paymentData.invoiceUrl,
      };

      if (paymentData.billingType === 'BOLETO') {
        updateData.asaas_barcode = paymentData.identificationField || paymentData.fullCycleCode;
        console.log(`Atualizando código de barras para: ${updateData.asaas_barcode}`);
      }

      // Se for PIX, buscar QR Code também
      let pixData = null;
      if (paymentData.billingType === 'PIX') {
        const pixResponse = await fetch(`${asaasBaseUrl}/payments/${paymentData.id}/pixQrCode`, {
          headers: { "access_token": asaas_api_key }
        });
        pixData = await pixResponse.json();
        updateData.asaas_pix_chave = pixData.payload;
        updateData.asaas_pix_qrcode = pixData.encodedImage;
      }

      const { error: updateError } = await supabaseClient
        .from("parcelas")
        .update(updateData)
        .eq("id", parcela_id);

      if (updateError) console.error("Erro ao atualizar parcela no fetch:", updateError);

      return new Response(JSON.stringify({ 
        success: true, 
        payment: paymentData, 
        pixData,
        updateParcela: updateData 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // SE FOR CRIAÇÃO (FLUXO ORIGINAL)
    if (!tipo) throw new Error("Tipo de cobrança é obrigatório para criação.");

    const matricula = parcela.matriculas;
    const aluno = Array.isArray(matricula) ? matricula[0]?.alunos : matricula?.alunos;

    if (!aluno) throw new Error("Aluno não encontrado para esta parcela.");

    let asaas_customer_id = aluno.asaas_customer_id;

    if (!asaas_customer_id) {
      console.log(`Criando cliente ${aluno.nome}...`);
      if (!aluno.cpf || !aluno.nome || !aluno.email) {
        throw new Error("Cadastro do aluno incompleto (Nome, CPF e E-mail são obrigatórios).");
      }

      const customerPayload = {
        name: aluno.nome,
        cpfCnpj: aluno.cpf.replace(/\D/g, ''),
        email: aluno.email,
        phone: aluno.telefone?.replace(/\D/g, ''),
        externalReference: aluno.id,
        notificationDisabled: true
      };

      const customerResponse = await fetch(`${asaasBaseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": asaas_api_key },
        body: JSON.stringify(customerPayload)
      });

      const customerData = await customerResponse.json();
      if (!customerResponse.ok) throw new Error(`Erro ao criar cliente: ${customerData.errors?.[0]?.description}`);

      asaas_customer_id = customerData.id;
      await supabaseClient.from("alunos").update({ asaas_customer_id }).eq("id", aluno.id);
    }

    let dueDate = parcela.data_vencimento;
    if (dueDate && dueDate.includes('T')) dueDate = dueDate.split('T')[0];

    const paymentPayload = {
      customer: asaas_customer_id,
      billingType: tipo === 'PIX' ? 'PIX' : 'BOLETO',
      value: Number(parcela.valor),
      dueDate: dueDate,
      description: parcela.descricao || `Parcela ${parcela.numero || ''}`,
      externalReference: parcela.id,
    };

    console.log("Enviando payload para criação...");
    const paymentResponse = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": asaas_api_key },
      body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentResponse.json();
    console.log("RETORNO ASAAS (CREATE):", JSON.stringify(paymentData));

    if (!paymentResponse.ok) throw new Error(`Erro ao criar cobrança: ${paymentData.errors?.[0]?.description}`);

    let pixData = null;
    if (tipo === 'PIX') {
      const pixResponse = await fetch(`${asaasBaseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { "access_token": asaas_api_key }
      });
      pixData = await pixResponse.json();
    }

    const updateParcela: any = {
      asaas_id: paymentData.id,
      asaas_url: paymentData.bankSlipUrl || paymentData.invoiceUrl,
      forma_pagamento: tipo.toLowerCase()
    };

    if (tipo === 'PIX' && pixData) {
      updateParcela.asaas_pix_chave = pixData.payload;
      updateParcela.asaas_pix_qrcode = pixData.encodedImage;
    } else if (tipo === 'BOLETO') {
      // Garantindo identificationField (47 dígitos)
      updateParcela.asaas_barcode = paymentData.identificationField || paymentData.fullCycleCode;
    }

    await supabaseClient.from("parcelas").update(updateParcela).eq("id", parcela_id);

    return new Response(JSON.stringify({ success: true, payment: paymentData, pixData, updateParcela }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("ERRO na function asaas-cobrar:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});