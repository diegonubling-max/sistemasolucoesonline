import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, asaas-access-token",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/hooks/asaas-webhook-aulao")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const event = payload?.event;
        const payment = payload?.payment;

        if (!event || !payment) {
          return jsonResponse({ ok: true, ignored: true });
        }

        // Eventos que indicam pagamento confirmado
        const CONFIRMED_EVENTS = [
          "PAYMENT_CONFIRMED",
          "PAYMENT_RECEIVED",
        ];

        if (!CONFIRMED_EVENTS.includes(event)) {
          return jsonResponse({ ok: true, event, ignored: true });
        }

        const externalReference = payment.externalReference;
        if (!externalReference) {
          return jsonResponse({ ok: true, no_ref: true });
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://qhvsveedougwymxjhbgi.supabase.co";
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodnN2ZWVkb3Vnd3lteGpoYmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODYxNTksImV4cCI6MjA5OTc2MjE1OX0.PPn-E410oEADMix5JUdluAoFkY13QTtMe2O74_t5r38";

        const supabase = createClient(supabaseUrl, supabaseKey);

        try {
          const { error } = await supabase
            .from("matriculas_aulao")
            .update({
              pagamento_status: "confirmado",
              pagamento_valor: payment.value,
            })
            .eq("id", externalReference);

          if (error) {
            console.error("[asaas-webhook-aulao] Erro ao atualizar:", error);
            return jsonResponse({ ok: false, error: error.message }, 500);
          }

          console.log(`[asaas-webhook-aulao] Pagamento confirmado para matrícula ${externalReference}`);
          return jsonResponse({ ok: true, matricula_id: externalReference, event });
        } catch (e: any) {
          console.error("[asaas-webhook-aulao] Erro:", e);
          return jsonResponse({ ok: false, error: e?.message }, 500);
        }
      },
    },
  },
});
