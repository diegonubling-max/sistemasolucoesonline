import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-client@2.39.3";

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

    const body = await req.json();
    console.log("Webhook Asaas recebido:", body);

    const { event, payment } = body;

    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const parcelaId = payment.externalReference;
      
      if (!parcelaId) {
        return new Response(JSON.stringify({ message: "externalReference não encontrado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Buscar parcela para confirmar existência
      const { data: parcela, error: fetchError } = await supabaseClient
        .from("parcelas")
        .select("id, status")
        .eq("id", parcelaId)
        .single();

      if (fetchError || !parcela) {
        console.error("Parcela não encontrada:", parcelaId, fetchError);
        return new Response(JSON.stringify({ message: "Parcela não encontrada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      // Atualizar status da parcela
      const { error: updateError } = await supabaseClient
        .from("parcelas")
        .update({
          status: "pago",
          data_pagamento: payment.confirmedDate || new Date().toISOString().split('T')[0],
          forma_pagamento: payment.billingType?.toLowerCase(),
          asaas_id: payment.id
        })
        .eq("id", parcelaId);

      if (updateError) {
        console.error("Erro ao atualizar parcela:", updateError);
        throw updateError;
      }

      console.log(`Parcela ${parcelaId} baixada com sucesso via webhook.`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Erro no webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
