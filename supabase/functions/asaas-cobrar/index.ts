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
    console.log("Iniciando processamento de cobrança por polo...");
    
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

    const { data: parcela, error: parcelaError } = await supabaseClient
      .from("parcelas")
      .select(`
        *,
        matriculas (
          aluno_id,
          alunos (
            *,
            polos (*)
          )
        )
      `)
      .eq("id", parcela_id)
      .single();

    if (parcelaError || !parcela) {
      console.error("Erro ao buscar parcela:", parcelaError);
      throw new Error("Parcela não encontrada.");
    }

    const matricula = parcela.matriculas;
    const aluno = Array.isArray(matricula) ? matricula[0]?.alunos : matricula?.alunos;
    const polo = aluno?.polos;

    if (!polo || !polo.asaas_api_key) {
      throw new Error(`Configurações do Asaas não encontradas para o polo ${polo?.nome || 'não identificado'}.`);
    }

    const asaas_api_key = polo.asaas_api_key;
    const asaas_ambiente = polo.asaas_ambiente || "producao";

    const asaasBaseUrl = asaas_ambiente === "producao" 
      ? "https://www.asaas.com/api/v3" 
      : "https://sandbox.asaas.com/api/v3";

    if (action === 'cancel') {
      // Cancela a cobrança existente no Asaas e limpa a parcela, pra deixar ela pronta pra
      // gerar uma cobrança nova (pedido do Diego, 28/08/2026 — caso real: editar o valor/
      // vencimento de uma parcela que já tinha boleto gerado não atualiza a cobrança no Asaas,
      // só o que aparece na tela do sistema; o botão de baixar sempre volta a mesma cobrança
      // antiga, com o valor errado).
      if (!parcela.asaas_id) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      console.log(`Cancelando cobrança ${parcela.asaas_id} no Asaas...`);
      const cancelResponse = await fetch(`${asaasBaseUrl}/payments/${parcela.asaas_id}`, {
        method: "DELETE",
        headers: { "access_token": asaas_api_key },
      });
      const cancelData = await cancelResponse.json();
      console.log("RETORNO ASAAS (CANCEL):", JSON.stringify(cancelData));

      // Se a cobrança já estava paga, o Asaas recusa o cancelamento (400) — nesse caso não faz
      // sentido mesmo cancelar, então só avisa e não mexe em mais nada.
      if (!cancelResponse.ok) {
        const desc = cancelData.errors?.[0]?.description || cancelResponse.statusText;
        throw new Error(`Erro ao cancelar cobrança no Asaas: ${desc}`);
      }

      const { error: clearError } = await supabaseClient
        .from("parcelas")
        .update({
          asaas_id: null,
          asaas_url: null,
          asaas_barcode: null,
          asaas_pix_chave: null,
          asaas_pix_qrcode: null,
        })
        .eq("id", parcela_id);

      if (clearError) console.error("Erro ao limpar parcela após cancelamento:", clearError);

      return new Response(JSON.stringify({ success: true, cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'receive_in_cash') {
      if (!parcela.asaas_id) {
        console.log(`Parcela ${parcela_id} sem asaas_id — nada a confirmar.`);
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const paymentDate = body.paymentDate || new Date().toISOString().split("T")[0];
      const value = body.value != null ? Number(body.value) : Number(parcela.valor);

      const receiveResponse = await fetch(`${asaasBaseUrl}/payments/${parcela.asaas_id}/receiveInCash`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": asaas_api_key },
        body: JSON.stringify({ paymentDate, value }),
      });
      const receiveData = await receiveResponse.json();
      console.log("RETORNO ASAAS (RECEIVE_IN_CASH):", JSON.stringify(receiveData));

      if (!receiveResponse.ok) {
        const desc = receiveData.errors?.[0]?.description || "";
        if (receiveResponse.status === 400 && /confirmad|receb/i.test(desc)) {
          return new Response(JSON.stringify({ success: true, already: true, payment: receiveData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        throw new Error(`Erro ao confirmar pagamento no Asaas: ${desc || receiveResponse.statusText}`);
      }

      return new Response(JSON.stringify({ success: true, payment: receiveData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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

      const updateData: any = {
        asaas_url: paymentData.bankSlipUrl || paymentData.invoiceUrl,
      };

      // BUG-050 (12/08/2026): esse "fetch" só atualizava o link do boleto/PIX — nunca conferia
      // se o Asaas já marcava a cobrança como paga, mesmo quando o webhook de confirmação
      // não chegou (ex: sincronização do webhook interrompida no painel do Asaas). Agora,
      // sempre que o Asaas mostrar a cobrança como recebida, a parcela é dada como paga aqui
      // também — funciona como uma segunda camada de segurança além do webhook.
      const statusPago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(paymentData.status);
      if (statusPago && parcela.status !== "pago") {
        updateData.status = "pago";
        updateData.data_pagamento = paymentData.paymentDate || paymentData.confirmedDate || paymentData.clientPaymentDate || new Date().toISOString().split("T")[0];
        if (paymentData.netValue != null) updateData.valor_liquido = Number(paymentData.netValue);
        console.log(`Cobrança ${parcela.asaas_id} já está paga no Asaas (status ${paymentData.status}) mas a parcela ainda estava em aberto — corrigindo.`);
      }

      if (paymentData.billingType === 'BOLETO') {
        console.log("Buscando identificationField do boleto (FETCH)...");
        const barcodeResponse = await fetch(`${asaasBaseUrl}/payments/${parcela.asaas_id}/identificationField`, {
          headers: { "access_token": asaas_api_key }
        });
        const barcodeData = await barcodeResponse.json();
        console.log("IDENTIFICATION FIELD (FETCH):", JSON.stringify(barcodeData));
        
        updateData.asaas_barcode = barcodeData.identificationField;
        paymentData.identificationField = barcodeData.identificationField;
        
        if (!updateData.asaas_url) {
          updateData.asaas_url = `${asaas_ambiente === "producao" ? "https://www.asaas.com" : "https://sandbox.asaas.com"}/b/pdf/${parcela.asaas_id}`;
          paymentData.bankSlipUrl = updateData.asaas_url;
        }
        
        console.log(`Atualizando código de barras para: ${updateData.asaas_barcode}`);
      }

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

    if (!tipo) throw new Error("Tipo de cobrança é obrigatório para criação.");

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

    // O Asaas não permite criar cobrança com vencimento no passado ("Não é permitido data de
    // vencimento inferior a hoje"). Se a parcela já estava vencida quando o boleto/PIX foi gerado
    // pela primeira vez (BUG-047), usamos a data de hoje pro Asaas, mas mantemos data_vencimento
    // original da parcela intacta no banco (pros relatórios de atraso continuarem corretos).
    const hojeStr = new Date().toISOString().split('T')[0];
    const dueDateParaAsaas = dueDate && dueDate < hojeStr ? hojeStr : dueDate;

    const paymentPayload = {
      customer: asaas_customer_id,
      billingType: tipo === 'PIX' ? 'PIX' : 'BOLETO',
      value: Number(parcela.valor),
      dueDate: dueDateParaAsaas,
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

    if (!paymentResponse.ok) throw new Error(`Erro ao criar cobrança: ${paymentData.errors?.[0]?.description || JSON.stringify(paymentData)}`);

    let paymentDetail = { ...paymentData };
    if (tipo === 'BOLETO') {
      console.log("Buscando identificationField do boleto (CREATE)...");
      const barcodeResponse = await fetch(`${asaasBaseUrl}/payments/${paymentData.id}/identificationField`, {
        headers: { "access_token": asaas_api_key }
      });
      
      if (barcodeResponse.ok) {
        const barcodeData = await barcodeResponse.json();
        console.log("IDENTIFICATION FIELD (CREATE):", JSON.stringify(barcodeData));
        paymentDetail.identificationField = barcodeData.identificationField;
      } else {
        const errorText = await barcodeResponse.text();
        console.error(`Erro ao buscar identificationField (${barcodeResponse.status}): ${errorText}`);
      }

      if (!paymentDetail.bankSlipUrl) {
        paymentDetail.bankSlipUrl = `${asaas_ambiente === "producao" ? "https://www.asaas.com" : "https://sandbox.asaas.com"}/b/pdf/${paymentData.id}`;
      }
    }

    let pixData = null;
    if (tipo === 'PIX') {
      const pixResponse = await fetch(`${asaasBaseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { "access_token": asaas_api_key }
      });
      pixData = await pixResponse.json();
    }

    const updateParcela: any = {
      asaas_id: paymentData.id,
      asaas_url: paymentDetail.bankSlipUrl || paymentDetail.invoiceUrl,
      forma_pagamento: tipo.toLowerCase()
    };

    if (tipo === 'PIX' && pixData) {
      updateParcela.asaas_pix_chave = pixData.payload;
      updateParcela.asaas_pix_qrcode = pixData.encodedImage;
    } else if (tipo === 'BOLETO') {
      updateParcela.asaas_barcode = paymentDetail.identificationField || paymentDetail.fullCycleCode;
      console.log(`Salvando código de barras: ${updateParcela.asaas_barcode}`);
    }

    await supabaseClient.from("parcelas").update(updateParcela).eq("id", parcela_id);

    return new Response(JSON.stringify({ success: true, payment: paymentDetail, pixData, updateParcela }), {
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
