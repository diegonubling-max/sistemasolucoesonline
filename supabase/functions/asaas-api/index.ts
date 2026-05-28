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

    const { path, method, body } = await req.json();

    // Buscar configurações
    const { data: configs } = await supabaseClient
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["asaas_api_key", "asaas_ambiente"]);

    const asaas_api_key = configs?.find(c => c.chave === "asaas_api_key")?.valor;
    const asaas_ambiente = configs?.find(c => c.chave === "asaas_ambiente")?.valor || "sandbox";

    if (!asaas_api_key) throw new Error("API Key do Asaas não configurada");

    const asaasBaseUrl = asaas_ambiente === "producao" 
      ? "https://api.asaas.com/v1" 
      : "https://sandbox.asaas.com/api/v1";

    const url = `${asaasBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    console.log(`Proxying ${method} request to Asaas: ${url}`);

    const response = await fetch(url, {
      method: method || 'GET',
      headers: {
        "Content-Type": "application/json",
        "access_token": asaas_api_key
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.status,
    });

  } catch (error: any) {
    console.error("Erro na asaas-api:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});