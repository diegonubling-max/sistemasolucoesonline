import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// BUG-050 (12/08/2026): reconciliacao diaria de seguranca. O webhook do Asaas as vezes nao
// chega (sincronizacao interrompida no painel do Asaas), deixando parcelas pagas presas como
// "aberto" no sistema sem ninguem perceber. Esse job roda 1x por dia (via pg_cron), confere
// TODA parcela em aberto com cobranca ja gerada direto na API do Asaas, e da baixa sozinho
// se o Asaas ja mostrar como recebida. Nao depende do webhook nem de alguem clicar em nada.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const resultado = { verificadas: 0, corrigidas: [] as any[], erros: [] as any[] };

  try {
    const { data: parcelas, error } = await supabase
      .from("parcelas")
      .select(`
        id, asaas_id, status, valor,
        matriculas ( aluno_id, alunos ( nome, ctr, polos ( id, nome, asaas_api_key, asaas_ambiente ) ) )
      `)
      .eq("status", "aberto")
      .not("asaas_id", "is", null);

    if (error) throw error;

    for (const parcela of parcelas ?? []) {
      resultado.verificadas++;
      const matricula: any = Array.isArray(parcela.matriculas) ? parcela.matriculas[0] : parcela.matriculas;
      const aluno = matricula?.alunos;
      const polo = aluno?.polos;

      if (!polo?.asaas_api_key) continue;

      const asaasBaseUrl = (polo.asaas_ambiente || "producao") === "producao"
        ? "https://www.asaas.com/api/v3"
        : "https://sandbox.asaas.com/api/v3";

      try {
        const resp = await fetch(`${asaasBaseUrl}/payments/${parcela.asaas_id}`, {
          headers: { "access_token": polo.asaas_api_key },
        });
        const paymentData = await resp.json();
        if (!resp.ok) {
          resultado.erros.push({ parcela_id: parcela.id, aluno: aluno?.nome, erro: paymentData?.errors?.[0]?.description || resp.statusText });
          continue;
        }

        const statusPago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(paymentData.status);
        if (statusPago) {
          const updateData: any = {
            status: "pago",
            data_pagamento: paymentData.paymentDate || paymentData.confirmedDate || paymentData.clientPaymentDate || new Date().toISOString().split("T")[0],
          };
          if (paymentData.netValue != null) updateData.valor_liquido = Number(paymentData.netValue);

          const { error: updErr } = await supabase.from("parcelas").update(updateData).eq("id", parcela.id);
          if (updErr) {
            resultado.erros.push({ parcela_id: parcela.id, aluno: aluno?.nome, erro: updErr.message });
          } else {
            resultado.corrigidas.push({ parcela_id: parcela.id, aluno: aluno?.nome, ctr: aluno?.ctr, valor: parcela.valor, data_pagamento: updateData.data_pagamento });
            console.log(`[reconciliar-pagamentos] Parcela ${parcela.id} (${aluno?.nome}, CTR ${aluno?.ctr}) estava paga no Asaas e presa no sistema — corrigida.`);
          }
        }
      } catch (e: any) {
        resultado.erros.push({ parcela_id: parcela.id, aluno: aluno?.nome, erro: e?.message });
      }
    }

    console.log(`[reconciliar-pagamentos] Verificadas: ${resultado.verificadas}, corrigidas: ${resultado.corrigidas.length}, erros: ${resultado.erros.length}`);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("[reconciliar-pagamentos] Erro geral:", e);
    return new Response(JSON.stringify({ error: e?.message, ...resultado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
