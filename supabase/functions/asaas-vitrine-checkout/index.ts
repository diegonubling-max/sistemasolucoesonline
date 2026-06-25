// Edge Function: cria cobrança PIX ou Cartão para curso da vitrine via Asaas
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_URL = "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const apiKey = Deno.env.get("ASAAS_API_KEY_VITRINE");
    if (!apiKey) throw new Error("ASAAS_API_KEY_VITRINE não configurada");

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      vitrine_id,
      forma_pagamento, // 'pix' | 'cartao'
      parcelas = 1,
      cartao, // { holderName, number, expiryMonth, expiryYear, ccv }
    } = body;

    if (!vitrine_id) throw new Error("vitrine_id é obrigatório");
    if (!["pix", "cartao"].includes(forma_pagamento)) throw new Error("forma_pagamento inválida");

    // Buscar vitrine + aluno
    const { data: vit, error: vitErr } = await supa
      .from("cursos_vitrine")
      .select(`
        id, curso_id, preco_pix, preco_normal, preco_com_pontos,
        resgatado_com_pontos,
        alunos:aluno_id ( id, nome, cpf, email, telefone, asaas_customer_id ),
        cursos:curso_id ( id, nome )
      `)
      .eq("id", vitrine_id)
      .single();

    if (vitErr || !vit) throw new Error("Curso da vitrine não encontrado");
    if (vit.resgatado_com_pontos) throw new Error("Curso já adquirido");

    const aluno: any = Array.isArray(vit.alunos) ? vit.alunos[0] : vit.alunos;
    const curso: any = Array.isArray(vit.cursos) ? vit.cursos[0] : vit.cursos;
    if (!aluno) throw new Error("Aluno não encontrado");
    if (!aluno.cpf || !aluno.email) throw new Error("Aluno sem CPF/e-mail cadastrado");

    const baseCartao = Number(vit.preco_com_pontos ?? vit.preco_normal ?? vit.preco_pix);
    const valorParcelaCartao = Number((baseCartao / 10).toFixed(2));
    const totalCartao = Number((valorParcelaCartao * 12).toFixed(2));
    const parcelasCartao = 12;
    const valorTotal = forma_pagamento === "pix" ? Number(vit.preco_pix) : totalCartao;

    // 1. Garantir customer
    let customerId = aluno.asaas_customer_id;
    if (!customerId) {
      // Tentar localizar por CPF
      const findResp = await fetch(
        `${ASAAS_URL}/customers?cpfCnpj=${aluno.cpf.replace(/\D/g, "")}`,
        { headers: { access_token: apiKey } },
      );
      const findData = await findResp.json();
      if (findData?.data?.[0]?.id) {
        customerId = findData.data[0].id;
      } else {
        const createResp = await fetch(`${ASAAS_URL}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: apiKey },
          body: JSON.stringify({
            name: aluno.nome,
            cpfCnpj: aluno.cpf.replace(/\D/g, ""),
            email: aluno.email,
            phone: aluno.telefone?.replace(/\D/g, ""),
            externalReference: aluno.id,
            notificationDisabled: true,
          }),
        });
        const createData = await createResp.json();
        if (!createResp.ok) throw new Error(`Asaas customer: ${createData.errors?.[0]?.description}`);
        customerId = createData.id;
      }
      await supa.from("alunos").update({ asaas_customer_id: customerId }).eq("id", aluno.id);
    }

    const today = new Date();
    const due = new Date(today);
    if (forma_pagamento === "pix") due.setDate(due.getDate() + 1);
    const dueDate = due.toISOString().split("T")[0];

    // 2. Criar registro de compra (pendente)
    const valorParcela = forma_pagamento === "cartao" && parcelas > 1
      ? Number((valorTotal / parcelas).toFixed(2))
      : valorTotal;

    const { data: compra, error: compraErr } = await supa
      .from("vitrine_compras")
      .insert({
        aluno_id: aluno.id,
        curso_id: vit.curso_id,
        vitrine_id: vit.id,
        forma_pagamento,
        parcelas: forma_pagamento === "cartao" ? parcelas : 1,
        valor_total: valorTotal,
        valor_parcela: valorParcela,
        status: "pendente",
      })
      .select()
      .single();
    if (compraErr || !compra) throw new Error(`Erro ao criar compra: ${compraErr?.message}`);

    // 3. Criar cobrança no Asaas
    const basePayload: any = {
      customer: customerId,
      billingType: forma_pagamento === "pix" ? "PIX" : "CREDIT_CARD",
      value: valorTotal,
      dueDate,
      description: `Curso: ${curso.nome}`,
      externalReference: compra.id,
    };

    if (forma_pagamento === "cartao") {
      if (parcelas > 1) {
        basePayload.installmentCount = parcelas;
        basePayload.installmentValue = valorParcela;
        delete basePayload.value;
      }
      if (!cartao) throw new Error("Dados do cartão são obrigatórios");
      basePayload.creditCard = {
        holderName: cartao.holderName,
        number: cartao.number.replace(/\s/g, ""),
        expiryMonth: cartao.expiryMonth,
        expiryYear: cartao.expiryYear,
        ccv: cartao.ccv,
      };
      basePayload.creditCardHolderInfo = {
        name: aluno.nome,
        email: aluno.email,
        cpfCnpj: aluno.cpf.replace(/\D/g, ""),
        postalCode: "88010000",
        addressNumber: "0",
        phone: aluno.telefone?.replace(/\D/g, "") || "48999999999",
      };
      basePayload.remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    }

    const payResp = await fetch(`${ASAAS_URL}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify(basePayload),
    });
    const payData = await payResp.json();
    console.log("ASAAS RESP", JSON.stringify(payData));
    if (!payResp.ok) {
      await supa.from("vitrine_compras").update({ status: "cancelado" }).eq("id", compra.id);
      throw new Error(payData.errors?.[0]?.description || "Erro Asaas");
    }

    const update: any = {
      asaas_payment_id: payData.id,
      asaas_invoice_url: payData.invoiceUrl || payData.bankSlipUrl || null,
    };

    let pixData: any = null;
    if (forma_pagamento === "pix") {
      const pixResp = await fetch(`${ASAAS_URL}/payments/${payData.id}/pixQrCode`, {
        headers: { access_token: apiKey },
      });
      pixData = await pixResp.json();
      update.asaas_pix_payload = pixData.payload;
      update.asaas_pix_qrcode = pixData.encodedImage;
    }

    // Cartão pode já ser confirmado na hora
    if (forma_pagamento === "cartao" && (payData.status === "CONFIRMED" || payData.status === "RECEIVED")) {
      update.status = "pago";
      update.paid_at = new Date().toISOString();
      await supa.rpc("liberar_curso_vitrine_pago", { p_compra_id: compra.id });
    }

    await supa.from("vitrine_compras").update(update).eq("id", compra.id);

    return new Response(
      JSON.stringify({
        success: true,
        compra_id: compra.id,
        payment_id: payData.id,
        status: payData.status,
        pix: pixData ? { payload: pixData.payload, encodedImage: pixData.encodedImage } : null,
        invoiceUrl: payData.invoiceUrl,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("asaas-vitrine-checkout erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
