import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");

    if (webhookToken && receivedToken !== webhookToken) {
      console.error("Token de webhook inválido");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    console.log("Webhook Asaas recebido:", JSON.stringify(body));

    const { event, payment } = body;

    if (!payment) {
      return new Response(JSON.stringify({ message: "Payload sem payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Localizar parcela por externalReference ou asaas_id
    const parcelaId = payment.externalReference;
    let query = supabaseClient.from("parcelas").select("id, status").limit(1);
    if (parcelaId) {
      query = query.eq("id", parcelaId);
    } else if (payment.id) {
      query = query.eq("asaas_id", payment.id);
    } else {
      return new Response(JSON.stringify({ message: "Sem referência" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: parcelas, error: fetchError } = await query;
    const parcela = parcelas?.[0];

    if (fetchError || !parcela) {
      console.error("Parcela não encontrada:", parcelaId, payment.id, fetchError);
      return new Response(JSON.stringify({ message: "Parcela não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Montar payload base com detalhes da cobrança
    const updateData: Record<string, any> = {
      asaas_id: payment.id,
      asaas_url: payment.bankSlipUrl || payment.invoiceUrl || null,
    };

    if (payment.billingType) {
      updateData.forma_pagamento = String(payment.billingType).toLowerCase();
    }
    if (payment.identificationField) {
      updateData.asaas_barcode = payment.identificationField;
    }
    if (payment.netValue != null) {
      updateData.valor_liquido = Number(payment.netValue);
    }

    // Tratar evento
    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
      case "PAYMENT_RECEIVED_IN_CASH":
        updateData.status = "pago";
        updateData.data_pagamento =
          payment.paymentDate ||
          payment.confirmedDate ||
          payment.clientPaymentDate ||
          new Date().toISOString().split("T")[0];
        break;

      case "PAYMENT_REFUNDED":
      case "PAYMENT_REFUND_IN_PROGRESS":
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_CHARGEBACK_DISPUTE":
      case "PAYMENT_AWAITING_CHARGEBACK_REVERSAL":
      case "PAYMENT_DELETED":
      case "PAYMENT_RESTORED":
      case "PAYMENT_OVERDUE":
        updateData.status = "aberto";
        updateData.data_pagamento = null;
        break;

      case "PAYMENT_CREATED":
      case "PAYMENT_UPDATED":
      case "PAYMENT_AWAITING_RISK_ANALYSIS":
      case "PAYMENT_APPROVED_BY_RISK_ANALYSIS":
      case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
      default:
        // Apenas atualiza detalhes da cobrança, sem alterar status
        break;
    }

    const { error: updateError } = await supabaseClient
      .from("parcelas")
      .update(updateData)
      .eq("id", parcela.id);

    if (updateError) {
      console.error("Erro ao atualizar parcela:", updateError);
      throw updateError;
    }

    console.log(`Parcela ${parcela.id} atualizada via webhook (${event}).`);

    return new Response(JSON.stringify({ received: true, event, parcela_id: parcela.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro no webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
