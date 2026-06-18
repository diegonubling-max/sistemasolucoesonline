import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmRiNTljZThjLTU0NDQtNDNlMS04MTQyLThmOTNkZGQ0MzRiZTo6JGFhY2hfNzk5YTBkNzYtOThhNS00MTM2LTgxYzktZGFmNDViNTdhOTUw";
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

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

    // Buscar parcelas com asaas_id de alunos migrados (via matricula -> aluno)
    const { data: parcelas, error: parcelasError } = await supabase
      .from("parcelas")
      .select("id, asaas_id, matricula_id, matriculas!inner(aluno_id, alunos!inner(id, nome, origem_detalhe))")
      .not("asaas_id", "is", null)
      .eq("matriculas.alunos.origem_detalhe", "migrado")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (parcelasError) throw parcelasError;

    let boletosCancelados = 0;
    const erros: { parcela: string; erro: string }[] = [];

    for (const parcela of parcelas || []) {
      try {
        const res = await fetch(`${ASAAS_BASE_URL}/payments/${parcela.asaas_id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            access_token: ASAAS_API_KEY,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 404) {
          throw new Error(`Asaas ${res.status}: ${data?.errors?.[0]?.description || JSON.stringify(data)}`);
        }

        await supabase
          .from("parcelas")
          .update({ asaas_id: null, asaas_url: null })
          .eq("id", parcela.id);

        boletosCancelados++;
      } catch (e: any) {
        erros.push({ parcela: String(parcela.id), erro: e.message });
      }
    }

    const processadosNoLote = parcelas?.length ?? 0;
    const proximoOffset = processadosNoLote < BATCH_SIZE ? null : offset + BATCH_SIZE;

    return new Response(
      JSON.stringify({
        success: true,
        boletos_cancelados: boletosCancelados,
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
