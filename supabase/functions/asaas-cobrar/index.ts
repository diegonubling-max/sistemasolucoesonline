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

    // 1. Buscar dados da parcela e do polo através do aluno
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
