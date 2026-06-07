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

    const body = await req.json();
    const { parcela_id, tipo, action = 'create' } = body;
    console.log(`Recebido: parcela_id=${parcela_id}, tipo=${tipo}, action=${action}`);

    if (!parcela_id) throw new Error("ID da parcela é obrigatório.");

    // Buscar dados da parcela e do aluno (para obter polo_id)
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

    if (parcelaError || !parcela) throw new Error("Parcela ou aluno não encontrados.");

    const aluno = parcela.matriculas.alunos;
    const polo = aluno.polos;

    if (!polo || !polo.asaas_api_key) {
        throw new Error(`Configurações Asaas não encontradas para o polo do aluno (${polo?.nome || 'Polo Desconhecido'}).`);
    }

    const asaas_api_key = polo.asaas_api_key;
    const asaas_ambiente = polo.asaas_ambiente || 'sandbox';

    const asaasBaseUrl = asaas_ambiente === "producao" 
      ? "https://www.asaas.com/api/v3" 
      : "https://sandbox.asaas.com/api/v3";

    // ... (rest of the logic remains largely the same, using asaas_api_key and asaasBaseUrl from the polo)
    // IMPORTANT: Make sure the customer creation and payment creation use these values
    // ...
  } catch (error: any) {
    console.error("ERRO:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
