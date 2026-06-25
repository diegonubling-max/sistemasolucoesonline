// Webhook do Asaas para compras da vitrine
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const received = req.headers.get("asaas-access-token");
    if (token && received !== token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    console.log("vitrine webhook:", JSON.stringify(body));
    const { event, payment } = body;
    if (!payment) return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });

    // Localizar compra
    let compraId: string | null = payment.externalReference || null;
    if (!compraId && payment.id) {
      const { data } = await supa.from("vitrine_compras").select("id").eq("asaas_payment_id", payment.id).maybeSingle();
      compraId = data?.id ?? null;
    }
    if (!compraId) return new Response(JSON.stringify({ ok: true, msg: "sem compra" }), { headers: { ...cors, "Content-Type": "application/json" } });

    if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"].includes(event)) {
      await supa.rpc("liberar_curso_vitrine_pago", { p_compra_id: compraId });

      // Enviar WhatsApp
      const { data: compra } = await supa
        .from("vitrine_compras")
        .select("aluno_id, cursos:curso_id(nome), alunos:aluno_id(nome, telefone)")
        .eq("id", compraId)
        .single();
      const aluno: any = Array.isArray(compra?.alunos) ? compra?.alunos[0] : compra?.alunos;
      const curso: any = Array.isArray(compra?.cursos) ? compra?.cursos[0] : compra?.cursos;
      if (aluno?.telefone) {
        const primeiroNome = (aluno.nome || "").split(" ")[0];
        const cap = primeiroNome ? primeiroNome[0].toUpperCase() + primeiroNome.slice(1).toLowerCase() : "";
        const msg = `*✅ Soluções Online — Compra confirmada!*\n\nOlá, *${cap}*! Seu pagamento foi confirmado e o curso *${curso?.nome}* já está liberado na sua área de estudos! 🎉\n\n👉 Acesse agora: https://sistemasolucoesonline.lovable.app/aluno/login`;
        try {
          await fetch(
            "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4/send-text",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "Client-Token": "F2ffd89a74df2440aad10b65315696d0eS" },
              body: JSON.stringify({ phone: "55" + aluno.telefone.replace(/\D/g, ""), message: msg }),
            },
          );
        } catch (e) { console.warn("z-api falhou:", e); }
      }
    } else if (["PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(event)) {
      await supa.from("vitrine_compras").update({ status: "cancelado" }).eq("id", compraId);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("webhook erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
