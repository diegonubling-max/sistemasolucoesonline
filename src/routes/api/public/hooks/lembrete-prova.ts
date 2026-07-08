import { createFileRoute } from "@tanstack/react-router";

const Z_API_BASE =
  "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4";
const Z_API_CLIENT_TOKEN = "F2ffd89a74df2440aad10b65315696d0eS";

function formatPhone(telefone: string) {
  const numero = (telefone || "").replace(/\D/g, "");
  return numero.startsWith("55") ? numero : "55" + numero;
}

function getPrimeiroNome(nome: string) {
  const p = (nome || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
}

export const Route = createFileRoute("/api/public/hooks/lembrete-prova")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Toggle global Z-API
        const { data: cfgGlobal } = await supabaseAdmin
          .from("configuracoes")
          .select("valor")
          .eq("chave", "zapi_global_ativo")
          .maybeSingle();
        if (cfgGlobal && cfgGlobal.valor === "false") {
          return new Response(JSON.stringify({ ok: true, skipped: "zapi_global_ativo=false" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const result = { enviados: 0, erros: [] as string[] };

        // Janela: agora+25min .. agora+35min (America/Sao_Paulo)
        const now = new Date();
        const nowSP = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const hojeISO = `${nowSP.getFullYear()}-${String(nowSP.getMonth() + 1).padStart(2, "0")}-${String(nowSP.getDate()).padStart(2, "0")}`;
        const inicio = new Date(nowSP.getTime() + 25 * 60 * 1000);
        const fim = new Date(nowSP.getTime() + 35 * 60 * 1000);
        const toHMS = (d: Date) =>
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
        const horaInicio = toHMS(inicio);
        const horaFim = toHMS(fim);

        try {
          const { data: provas, error } = await supabaseAdmin
            .from("prova_agendamentos")
            .select("id, aluno_id, hora_prova, data_prova, status, alunos:aluno_id(id, nome, telefone)")
            .eq("data_prova", hojeISO)
            .eq("status", "agendada")
            .gte("hora_prova", horaInicio)
            .lte("hora_prova", horaFim);
          if (error) throw error;

          for (const p of provas ?? []) {
            const aluno = (p as any)?.alunos;
            if (!aluno?.telefone) continue;
            const hora = String(p.hora_prova).substring(0, 5);
            const nome = getPrimeiroNome(aluno.nome);
            const mensagem = `Oi, *${nome}*! 👋

Lembrete: sua prova está agendada para hoje às *${hora}*. ⏰

Certifique-se de estar com uma boa conexão de internet na hora da prova, para não ocorrer perda de sinal e ter que refazê-la novamente.

Caso queira reagendar para uma nova data e horário, nos comunique.

Boa sorte! 🍀`;

            try {
              const res = await fetch(`${Z_API_BASE}/send-text`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Client-Token": Z_API_CLIENT_TOKEN,
                },
                body: JSON.stringify({ phone: formatPhone(aluno.telefone), message: mensagem }),
              });
              const body = await res.text().catch(() => "");
              if (!res.ok) {
                await supabaseAdmin.from("zapi_mensagens_log").insert({
                  aluno_id: aluno.id,
                  tipo: "lembrete_prova",
                  mensagem,
                  status: "erro",
                  erro_detalhe: `HTTP ${res.status}: ${body}`,
                });
                result.erros.push(`aluno ${aluno.id}: HTTP ${res.status}`);
              } else {
                await supabaseAdmin.from("zapi_mensagens_log").insert({
                  aluno_id: aluno.id,
                  tipo: "lembrete_prova",
                  mensagem,
                  status: "enviado",
                });
                result.enviados++;
              }
            } catch (e: any) {
              await supabaseAdmin.from("zapi_mensagens_log").insert({
                aluno_id: aluno.id,
                tipo: "lembrete_prova",
                mensagem,
                status: "erro",
                erro_detalhe: e?.message || String(e),
              });
              result.erros.push(`aluno ${aluno.id}: ${e?.message || e}`);
            }
          }
        } catch (e: any) {
          result.erros.push("query: " + (e?.message || String(e)));
        }

        return new Response(
          JSON.stringify({ ok: true, hoje: hojeISO, janela: [horaInicio, horaFim], ...result }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
