import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// BUG-050 (12/08/2026): reconciliacao diaria de seguranca. O webhook do Asaas as vezes nao
// chega (sincronizacao interrompida no painel do Asaas), deixando pagamentos presos como
// pendente no sistema sem ninguem perceber. Esse job roda 1x por dia (via pg_cron), confere
// direto na API do Asaas, e da baixa sozinho se o Asaas ja mostrar como recebido. Nao depende
// do webhook nem de alguem clicar em nada.
// (18/08/2026) Estendido pra tambem cobrir matriculas_aulao, alem de parcelas -- antes so
// cobria alunos ja matriculados, deixando o funil do Aulao sem essa rede de seguranca.

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

  const resultado = {
    parcelas: { verificadas: 0, corrigidas: [] as any[], erros: [] as any[] },
    aulao: { verificadas: 0, corrigidas: [] as any[], erros: [] as any[] },
  };

  // 1) Alunos ja matriculados (parcelas)
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
      resultado.parcelas.verificadas++;
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
          resultado.parcelas.erros.push({ parcela_id: parcela.id, aluno: aluno?.nome, erro: paymentData?.errors?.[0]?.description || resp.statusText });
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
            resultado.parcelas.erros.push({ parcela_id: parcela.id, aluno: aluno?.nome, erro: updErr.message });
          } else {
            resultado.parcelas.corrigidas.push({ parcela_id: parcela.id, aluno: aluno?.nome, ctr: aluno?.ctr, valor: parcela.valor, data_pagamento: updateData.data_pagamento });
            console.log(`[reconciliar-pagamentos] Parcela ${parcela.id} (${aluno?.nome}, CTR ${aluno?.ctr}) estava paga no Asaas e presa no sistema — corrigida.`);
          }
        }
      } catch (e: any) {
        resultado.parcelas.erros.push({ parcela_id: parcela.id, aluno: aluno?.nome, erro: e?.message });
      }
    }
  } catch (e: any) {
    console.error("[reconciliar-pagamentos] Erro geral (parcelas):", e);
    resultado.parcelas.erros.push({ erro: e?.message });
  }

  // 2) Leads do Aulao (matriculas_aulao) — cobranca gerada mas pagamento_status ainda pendente
  try {
    const { data: leads, error } = await supabase
      .from("matriculas_aulao")
      .select("id, nome, telefone, asaas_payment_id, polo_id, pagamento_status")
      .eq("pagamento_status", "pendente")
      .not("asaas_payment_id", "is", null);

    if (error) throw error;

    // Cache de polos consultados, pra nao repetir select
    const polosCache = new Map<string, any>();

    for (const lead of leads ?? []) {
      resultado.aulao.verificadas++;

      let polo = lead.polo_id ? polosCache.get(lead.polo_id) : null;
      if (!polo && lead.polo_id) {
        const { data: poloData } = await supabase
          .from("polos")
          .select("asaas_api_key, asaas_ambiente")
          .eq("id", lead.polo_id)
          .maybeSingle();
        polo = poloData;
        if (polo) polosCache.set(lead.polo_id, polo);
      }

      if (!polo?.asaas_api_key) {
        resultado.aulao.erros.push({ lead_id: lead.id, nome: lead.nome, erro: "Polo sem asaas_api_key" });
        continue;
      }

      const asaasBaseUrl = (polo.asaas_ambiente || "producao") === "producao"
        ? "https://www.asaas.com/api/v3"
        : "https://sandbox.asaas.com/api/v3";

      try {
        const resp = await fetch(`${asaasBaseUrl}/payments/${lead.asaas_payment_id}`, {
          headers: { "access_token": polo.asaas_api_key },
        });
        const paymentData = await resp.json();
        if (!resp.ok) {
          resultado.aulao.erros.push({ lead_id: lead.id, nome: lead.nome, erro: paymentData?.errors?.[0]?.description || resp.statusText });
          continue;
        }

        const statusPago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(paymentData.status);
        if (statusPago) {
          const { error: updErr } = await supabase
            .from("matriculas_aulao")
            .update({ pagamento_status: "confirmado" })
            .eq("id", lead.id);

          if (updErr) {
            resultado.aulao.erros.push({ lead_id: lead.id, nome: lead.nome, erro: updErr.message });
          } else {
            resultado.aulao.corrigidas.push({ lead_id: lead.id, nome: lead.nome, telefone: lead.telefone });
            console.log(`[reconciliar-pagamentos] Lead do Aulao ${lead.id} (${lead.nome}) estava pago no Asaas e preso como pendente — corrigido.`);

            // Dispara a criacao do acesso do aluno (idempotente, mesma logica do webhook normal)
            try {
              await fetch(`${Deno.env.get("SITE_URL") || "https://sistema.supletivosolucoesonline.com.br"}/api/public/hooks/converter-matricula-aulao`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matricula_aulao_id: lead.id }),
              });
            } catch (convErr) {
              console.error(`[reconciliar-pagamentos] Erro ao converter lead ${lead.id} em acesso:`, convErr);
            }
          }
        }
      } catch (e: any) {
        resultado.aulao.erros.push({ lead_id: lead.id, nome: lead.nome, erro: e?.message });
      }
    }
  } catch (e: any) {
    console.error("[reconciliar-pagamentos] Erro geral (aulao):", e);
    resultado.aulao.erros.push({ erro: e?.message });
  }

  console.log(`[reconciliar-pagamentos] Parcelas: ${resultado.parcelas.verificadas} verificadas, ${resultado.parcelas.corrigidas.length} corrigidas. Aulão: ${resultado.aulao.verificadas} verificadas, ${resultado.aulao.corrigidas.length} corrigidas.`);

  return new Response(JSON.stringify(resultado), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
