// Edge Function: consulta status de uma compra (botão "Já paguei")
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const apiKey = Deno.env.get("ASAAS_API_KEY_VITRINE")!;
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { compra_id } = await req.json();
    if (!compra_id) throw new Error("compra_id obrigatório");

    const { data: compra } = await supa.from("vitrine_compras").select("*").eq("id", compra_id).single();
    if (!compra) throw new Error("Compra não encontrada");
    if (compra.status === "pago") {
      return new Response(JSON.stringify({ status: "pago" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!compra.asaas_payment_id) throw new Error("Sem payment_id");

    const r = await fetch(`https://api.asaas.com/v3/payments/${compra.asaas_payment_id}`, {
      headers: { access_token: apiKey },
    });
    const data = await r.json();
    const pago = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(data.status);
    if (pago) {
      await supa.rpc("liberar_curso_vitrine_pago", { p_compra_id: compra.id });
      return new Response(JSON.stringify({ status: "pago" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ status: "pendente", asaas_status: data.status }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
