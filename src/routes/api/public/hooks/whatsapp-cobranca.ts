import { createFileRoute } from "@tanstack/react-router";
import { sendLembreteVencimento, sendAvisoAtraso } from "@/services/zApiService";

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
              "id, valor, data_vencimento, status, matriculas:matricula_id!inner(alunos:aluno_id!inner(id, nome, telefone, ativo))",
            )
            .eq("data_vencimento", em3Dias)
            .in("status", ["aberto", "parcial"])
            .eq("matriculas.alunos.ativo", true)
            .gt("valor", 0);
          if (error) throw error;
          for (const p of vencendo ?? []) {
            const aluno = (p as any)?.matriculas?.alunos;
            if (!aluno?.telefone) continue;
            const enviado = await sendLembreteVencimento({
              telefone: aluno.telefone,
              nome: aluno.nome,
              valor: Number(p.valor),
              dataVencimento: p.data_vencimento as string,
              alunoId: aluno.id,
            });
            if (enviado) result.lembretes++;
          }
        } catch (e: any) {
          result.erros.push("lembretes: " + e.message);
        }

        // 2) Avisos de atraso (vencidas há mais de 1 dia, não pagas)
        try {
          const { data: atrasadas, error } = await supabaseAdmin
            .from("parcelas")
            .select(
              "id, valor, data_vencimento, status, matriculas:matricula_id!inner(alunos:aluno_id!inner(id, nome, telefone, ativo))",
            )
            .lt("data_vencimento", ontem)
            .in("status", ["aberto", "parcial"])
            .eq("matriculas.alunos.ativo", true)
            .gt("valor", 0);
          if (error) throw error;
          for (const p of atrasadas ?? []) {
            const aluno = (p as any)?.matriculas?.alunos;
            if (!aluno?.telefone) continue;
            const enviado = await sendAvisoAtraso({
              telefone: aluno.telefone,
              nome: aluno.nome,
              valor: Number(p.valor),
              dataVencimento: p.data_vencimento as string,
              alunoId: aluno.id,
            });
            if (enviado) result.atrasos++;
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
