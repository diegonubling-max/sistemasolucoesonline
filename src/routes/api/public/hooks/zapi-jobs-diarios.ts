import { createFileRoute } from "@tanstack/react-router";
import {
  sendNuncaAcessou,
  sendSemAcesso4Dias,
  sendMensagemSabado,
  sendMensagemDomingo,
} from "@/services/zApiService";

// Verifica se o aluno cai no grupo do horário (split aleatório estável por id)
function alunoNoGrupo(alunoId: string, grupo: number): boolean {
  // soma simples dos char codes -> mod 3
  let acc = 0;
  for (let i = 0; i < alunoId.length; i++) acc = (acc + alunoId.charCodeAt(i)) % 9973;
  return acc % 3 === grupo;
}

function diasUteisEntre(desde: Date, ate: Date): number {
  let count = 0;
  const d = new Date(desde);
  d.setHours(0, 0, 0, 0);
  const fim = new Date(ate);
  fim.setHours(0, 0, 0, 0);
  while (d < fim) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// Brasília = UTC-3 (sem horário de verão atual)
function nowBR(): Date {
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

export const Route = createFileRoute("/api/public/hooks/zapi-jobs-diarios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let grupo = 0;
        try {
          const body = (await request.json()) as { grupo?: number };
          grupo = Number(body?.grupo ?? 0) % 3;
        } catch {
          grupo = 0;
        }

        const hojeBR = nowBR();
        const dow = hojeBR.getDay(); // 0 dom .. 6 sab
        const result = {
          grupo,
          nunca_acessou: 0,
          quatro_dias: 0,
          sabado: 0,
          domingo: 0,
          erros: [] as string[],
        };

        // Buscar alunos ativos (status ativo)
        const { data: alunos, error: alunosErr } = await supabaseAdmin
          .from("alunos")
          .select("id, nome, telefone, ctr, status, ativo, created_at")
          .eq("ativo", true)
          .neq("status", "trancado")
          .neq("status", "inativo");

        if (alunosErr) {
          return new Response(JSON.stringify({ ok: false, error: alunosErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const alunosGrupo = (alunos ?? []).filter((a) => alunoNoGrupo(a.id, grupo));

        // Disparos já registrados deste grupo
        const ids = alunosGrupo.map((a) => a.id);
        const { data: disparos } = await supabaseAdmin
          .from("zapi_disparos_controle")
          .select("aluno_id, tipo_disparo")
          .in("aluno_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        const jaEnviado = new Set((disparos ?? []).map((d) => `${d.aluno_id}:${d.tipo_disparo}`));

        async function marcar(aluno_id: string, tipo: string) {
          await supabaseAdmin
            .from("zapi_disparos_controle")
            .insert({ aluno_id, tipo_disparo: tipo });
        }

        async function ultimaAula(alunoId: string): Promise<{ aula: string | null; materia: string | null }> {
          const { data } = await supabaseAdmin
            .from("aluno_aulas_assistidas")
            .select("assistida_em, aulas:aula_id(titulo, cursos:curso_id(nome))")
            .eq("aluno_id", alunoId)
            .order("assistida_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          const aula = (data as any)?.aulas?.titulo ?? null;
          const materia = (data as any)?.aulas?.cursos?.nome ?? null;
          return { aula, materia };
        }

        for (const aluno of alunosGrupo) {
          if (!aluno.telefone) continue;

          // 1) Nunca acessou + matrícula > 24h
          try {
            const key = `${aluno.id}:nunca_acessou`;
            if (!jaEnviado.has(key)) {
              const horasDesdeMatricula =
                (Date.now() - new Date(aluno.created_at as string).getTime()) / 36e5;
              if (horasDesdeMatricula >= 24) {
                const { count } = await supabaseAdmin
                  .from("aluno_sessoes")
                  .select("id", { count: "exact", head: true })
                  .eq("aluno_id", aluno.id);
                if ((count ?? 0) === 0) {
                  await sendNuncaAcessou({
                    telefone: aluno.telefone,
                    nome: aluno.nome,
                    ctr: aluno.ctr,
                  });
                  await marcar(aluno.id, "nunca_acessou");
                  result.nunca_acessou++;
                  continue; // não enviar 2 mensagens no mesmo job
                }
              }
            }
          } catch (e: any) {
            result.erros.push(`nunca_acessou ${aluno.id}: ${e.message}`);
          }

          // 2) Sem acesso há 4 dias úteis (só seg-sex)
          if (dow >= 1 && dow <= 5) {
            try {
              const key = `${aluno.id}:4_dias_uteis`;
              if (!jaEnviado.has(key)) {
                const { data: ultSess } = await supabaseAdmin
                  .from("aluno_sessoes")
                  .select("login_em")
                  .eq("aluno_id", aluno.id)
                  .order("login_em", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (ultSess?.login_em) {
                  const diasUteis = diasUteisEntre(new Date(ultSess.login_em), hojeBR);
                  if (diasUteis >= 4) {
                    const { aula, materia } = await ultimaAula(aluno.id);
                    const diasCorridos = Math.floor(
                      (hojeBR.getTime() - new Date(ultSess.login_em).getTime()) / 86400000,
                    );
                    await sendSemAcesso4Dias({
                      telefone: aluno.telefone,
                      nome: aluno.nome,
                      dias: diasCorridos,
                      ultimaAula: aula,
                      materia,
                    });
                    await marcar(aluno.id, "4_dias_uteis");
                    result.quatro_dias++;
                    continue;
                  }
                }
              }
            } catch (e: any) {
              result.erros.push(`4_dias ${aluno.id}: ${e.message}`);
            }
          }

          // 3) Sábado — enviar sempre que for sábado e aluno não acessou hoje
          if (dow === 6) {
            try {
              const inicioDia = new Date(hojeBR);
              inicioDia.setHours(0, 0, 0, 0);
              const { count } = await supabaseAdmin
                .from("aluno_sessoes")
                .select("id", { count: "exact", head: true })
                .eq("aluno_id", aluno.id)
                .gte("login_em", inicioDia.toISOString());
              if ((count ?? 0) === 0) {
                const { aula, materia } = await ultimaAula(aluno.id);
                await sendMensagemSabado({
                  telefone: aluno.telefone,
                  nome: aluno.nome,
                  ultimaAula: aula,
                  materia,
                });
                result.sabado++;
              }
            } catch (e: any) {
              result.erros.push(`sabado ${aluno.id}: ${e.message}`);
            }
          }

          // 4) Domingo
          if (dow === 0) {
            try {
              const inicioDia = new Date(hojeBR);
              inicioDia.setHours(0, 0, 0, 0);
              const { count } = await supabaseAdmin
                .from("aluno_sessoes")
                .select("id", { count: "exact", head: true })
                .eq("aluno_id", aluno.id)
                .gte("login_em", inicioDia.toISOString());
              if ((count ?? 0) === 0) {
                const { aula, materia } = await ultimaAula(aluno.id);
                await sendMensagemDomingo({
                  telefone: aluno.telefone,
                  nome: aluno.nome,
                  ultimaAula: aula,
                  materia,
                });
                result.domingo++;
              }
            } catch (e: any) {
              result.erros.push(`domingo ${aluno.id}: ${e.message}`);
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
