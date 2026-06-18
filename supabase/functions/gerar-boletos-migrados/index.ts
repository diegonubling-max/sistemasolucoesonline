import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmRiNTljZThjLTU0NDQtNDNlMS04MTQyLThmOTNkZGQ0MzRiZTo6JGFhY2hfNzk5YTBkNzYtOThhNS00MTM2LTgxYzktZGFmNDViNTdhOTUw";
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

function onlyDigits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

async function asaasFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Asaas ${path} ${res.status}: ${
        data?.errors?.[0]?.description || JSON.stringify(data)
      }`
    );
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const BATCH_SIZE = 10;
    let offset = 0;
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.offset === "number") offset = body.offset;
    } catch {}

    // Buscar lote de alunos migrados
    const { data: alunos, error: alunosError } = await supabase
      .from("alunos")
      .select(
        `id, nome, email, cpf, telefone, asaas_customer_id,
         matriculas:matriculas!matriculas_aluno_id_fkey(
           id,
           parcelas(id, valor, data_vencimento, status, asaas_id)
         )`
      )
      .eq("origem_detalhe", "migrado")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (alunosError) throw alunosError;

    let clientesCriados = 0;
    let boletosGerados = 0;
    const erros: { aluno: string; erro: string }[] = [];

    for (const aluno of alunos || []) {
      const parcelasAbertas = (aluno.matriculas || [])
        .flatMap((m: any) => m.parcelas || [])
        .filter((p: any) => p.status === "aberto" && !p.asaas_id);

      if (parcelasAbertas.length === 0) continue;

      try {
        let customerId = aluno.asaas_customer_id;
        if (!customerId) {
          const customer = await asaasFetch("/customers", {
            method: "POST",
            body: JSON.stringify({
              name: aluno.nome,
              email: aluno.email || undefined,
              cpfCnpj: onlyDigits(aluno.cpf),
              phone: onlyDigits(aluno.telefone),
            }),
          });
          customerId = customer.id;
          clientesCriados++;
          await supabase
            .from("alunos")
            .update({ asaas_customer_id: customerId })
            .eq("id", aluno.id);
        }

        for (const parcela of parcelasAbertas) {
          try {
            const payment = await asaasFetch("/payments", {
              method: "POST",
              body: JSON.stringify({
                customer: customerId,
                billingType: "BOLETO",
                value: Number(parcela.valor),
                dueDate: parcela.data_vencimento,
                description: "Mensalidade EJA Soluções Online",
              }),
            });

            await supabase
              .from("parcelas")
              .update({
                asaas_id: payment.id,
                asaas_url: payment.bankSlipUrl || payment.invoiceUrl,
              })
              .eq("id", parcela.id);

            boletosGerados++;
          } catch (e: any) {
            erros.push({
              aluno: aluno.nome,
              erro: `Parcela ${parcela.id}: ${e.message}`,
            });
          }
        }
      } catch (e: any) {
        erros.push({ aluno: aluno.nome, erro: e.message });
      }
    }

    const processadosNoLote = alunos?.length ?? 0;
    const proximoOffset = processadosNoLote < BATCH_SIZE ? null : offset + BATCH_SIZE;

    return new Response(
      JSON.stringify({
        success: true,
        clientes_criados: clientesCriados,
        boletos_gerados: boletosGerados,
        proximo_offset: proximoOffset,
        total_processado: offset + processadosNoLote,
        erros,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

