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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { parcela_id, tipo } = await req.json();

    if (!parcela_id || !tipo) {
      throw new Error("ID da parcela e tipo são obrigatórios.");
    }

    // 2. Buscar configurações do Asaas
    const { data: configs, error: configError } = await supabaseClient
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["asaas_api_key", "asaas_ambiente"]);

    if (configError) throw configError;

    const asaas_api_key = configs.find(c => c.chave === "asaas_api_key")?.valor;
    const asaas_ambiente = configs.find(c => c.chave === "asaas_ambiente")?.valor || "sandbox";

    if (!asaas_api_key) {
      throw new Error("Chave de API do Asaas não configurada.");
    }

    const asaasBaseUrl = asaas_ambiente === "producao" 
      ? "https://api.asaas.com/v1" 
      : "https://sandbox.asaas.com/api/v1";

    // 3. Buscar dados da parcela e do aluno
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

    if (parcelaError || !parcela) throw new Error("Parcela não encontrada.");

    const matricula = parcela.matriculas;
    const aluno = matricula?.alunos;

    if (!aluno) throw new Error("Aluno não encontrado para esta parcela.");

    let asaas_customer_id = aluno.asaas_customer_id;

    // 4. Se não tiver asaas_customer_id, criar cliente
    if (!asaas_customer_id) {
      if (!aluno.cpf || !aluno.nome || !aluno.email) {
        throw new Error("Cadastro do aluno incompleto (Nome, CPF e E-mail são obrigatórios).");
      }

      console.log(`Criando cliente no Asaas para aluno ${aluno.id}`);
      
      const customerResponse = await fetch(`${asaasBaseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaas_api_key
        },
        body: JSON.stringify({
          name: aluno.nome,
          cpfCnpj: aluno.cpf.replace(/\D/g, ''),
          email: aluno.email,
          phone: aluno.telefone,
          externalReference: aluno.id,
          notificationDisabled: true
        })
      });

      const customerData = await customerResponse.json();
      if (!customerResponse.ok) {
        throw new Error(`Erro ao criar cliente no Asaas: ${customerData.errors?.[0]?.description || customerResponse.statusText}`);
      }

      asaas_customer_id = customerData.id;

      // Salvar asaas_customer_id no banco
      const { error: updateAlunoError } = await supabaseClient
        .from("alunos")
        .update({ asaas_customer_id })
        .eq("id", aluno.id);

      if (updateAlunoError) console.error("Erro ao salvar asaas_customer_id:", updateAlunoError);
    }

    // 5. Criar cobrança no Asaas
    console.log(`Gerando cobrança ${tipo} para parcela ${parcela_id}`);
    
    const paymentResponse = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaas_api_key
      },
      body: JSON.stringify({
        customer: asaas_customer_id,
        billingType: tipo,
        value: Number(parcela.valor),
        dueDate: parcela.data_vencimento,
        description: parcela.descricao || `Parcela ${parcela.numero}`,
        externalReference: parcela.id,
      })
    });

    const paymentData = await paymentResponse.json();
    if (!paymentResponse.ok) {
      throw new Error(`Erro ao criar cobrança no Asaas: ${paymentData.errors?.[0]?.description || paymentResponse.statusText}`);
    }

    // 6. Buscar QR Code se for PIX
    let pixData = null;
    if (tipo === 'PIX') {
      const pixResponse = await fetch(`${asaasBaseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { "access_token": asaas_api_key }
      });
      pixData = await pixResponse.json();
    }

    // 7. Atualizar a parcela com os dados do Asaas
    const updateParcela: any = {
      asaas_id: paymentData.id,
      asaas_url: paymentData.bankSlipUrl || paymentData.invoiceUrl,
      forma_pagamento: tipo.toLowerCase()
    };

    if (tipo === 'PIX' && pixData) {
      updateParcela.asaas_pix_chave = pixData.payload;
      updateParcela.asaas_pix_qrcode = pixData.encodedImage;
    } else if (tipo === 'BOLETO') {
      updateParcela.asaas_barcode = paymentData.identificationField;
    }

    const { error: updateParcelaError } = await supabaseClient
      .from("parcelas")
      .update(updateParcela)
      .eq("id", parcela_id);

    if (updateParcelaError) throw updateParcelaError;

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
    console.error("Erro na function asaas-cobrar:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});