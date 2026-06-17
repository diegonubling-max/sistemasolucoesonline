import { createFileRoute } from "@tanstack/react-router";

const Z_API_BASE =
  "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4";
const Z_API_CLIENT_TOKEN = "E55BC981D8AA6846EAFEAEE4";

function formatPhone(telefone: string) {
  const numero = (telefone || "").replace(/\D/g, "");
  return numero.startsWith("55") ? numero : "55" + numero;
}

function formatBRL(v: number) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function sendWhatsApp(telefone: string, mensagem: string) {
  if (!telefone) return;
  try {
    const res = await fetch(`${Z_API_BASE}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": Z_API_CLIENT_TOKEN },
      body: JSON.stringify({ phone: formatPhone(telefone), message: mensagem }),
    });
    console.log("[zApi cron]", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("[zApi cron] erro envio:", e);
  }
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-cobranca")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const hoje = new Date();
        const hojeISO = hoje.toISOString().slice(0, 10);
        const em3Dias = addDays(hoje, 3);
        const ontem = addDays(hoje, -1);

        const result = { lembretes: 0, atrasos: 0, erros: [] as string[] };

        // 1) Lembretes 3 dias antes do vencimento
        try {
          const { data: vencendo, error } = await supabaseAdmin
            .from("parcelas")
            .select(
              "id, valor, data_vencimento, status, matriculas:matricula_id(alunos:aluno_id(nome, telefone))",
            )
            .eq("data_vencimento", em3Dias)
            .neq("status", "pago");
          if (error) throw error;
          for (const p of vencendo ?? []) {
            const aluno = (p as any)?.matriculas?.alunos;
            if (!aluno?.telefone) continue;
            const msg = `*⚠️ Soluções Online — Lembrete de Pagamento*

Olá, *${aluno.nome}*! Sua parcela de *R$ ${formatBRL(Number(p.valor))}* vence em *3 dias* (${formatDateBR(p.data_vencimento as string)}).

Evite a interrupção do seu acesso aos estudos. Regularize em dia! 📚`;
            await sendWhatsApp(aluno.telefone, msg);
            result.lembretes++;
          }
        } catch (e: any) {
          result.erros.push("lembretes: " + e.message);
        }

        // 2) Avisos de atraso (vencidas há mais de 1 dia, não pagas)
        try {
          const { data: atrasadas, error } = await supabaseAdmin
            .from("parcelas")
            .select(
              "id, valor, data_vencimento, status, matriculas:matricula_id(alunos:aluno_id(nome, telefone))",
            )
            .lt("data_vencimento", ontem)
            .neq("status", "pago");
          if (error) throw error;
          for (const p of atrasadas ?? []) {
            const aluno = (p as any)?.matriculas?.alunos;
            if (!aluno?.telefone) continue;
            const msg = `*🔴 Soluções Online — Parcela em Atraso*

Olá, *${aluno.nome}*! Identificamos que sua parcela de *R$ ${formatBRL(Number(p.valor))}* está em atraso desde ${formatDateBR(p.data_vencimento as string)}.

Regularize agora para manter seu acesso! Entre em contato conosco.`;
            await sendWhatsApp(aluno.telefone, msg);
            result.atrasos++;
          }
        } catch (e: any) {
          result.erros.push("atrasos: " + e.message);
        }

        return new Response(JSON.stringify({ ok: true, hoje: hojeISO, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
