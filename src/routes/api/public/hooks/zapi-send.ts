import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function formatPhone(telefone: string) {
  const numero = (telefone || "").replace(/\D/g, "");
  if (!numero) return "";
  return numero.startsWith("55") ? numero : "55" + numero;
}

export const Route = createFileRoute("/api/public/hooks/zapi-send")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let payload: { phone?: string; message?: string };
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const phoneRaw = payload?.phone;
        const message = payload?.message;
        if (!phoneRaw || !message || typeof message !== "string") {
          return jsonResponse({ error: "phone e message obrigatórios" }, 400);
        }

        const instanceId = process.env.ZAPI_INSTANCE_ID;
        const token = process.env.ZAPI_TOKEN;
        const clientToken = process.env.ZAPI_CLIENT_TOKEN;
        if (!instanceId || !token || !clientToken) {
          return jsonResponse({ error: "Z-API não configurada" }, 500);
        }

        const phone = formatPhone(String(phoneRaw));
        if (!phone) return jsonResponse({ error: "telefone inválido" }, 400);

        try {
          const res = await fetch(
            `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Client-Token": clientToken,
              },
              body: JSON.stringify({ phone, message }),
            },
          );
          const text = await res.text().catch(() => "");
          let data: unknown = text;
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            /* keep as text */
          }
          return jsonResponse({ ok: res.ok, status: res.status, data }, res.ok ? 200 : res.status);
        } catch (e: any) {
          return jsonResponse({ ok: false, error: e?.message || String(e) }, 502);
        }
      },
    },
  },
});
