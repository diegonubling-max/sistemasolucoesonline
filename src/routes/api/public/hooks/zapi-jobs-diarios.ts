import { createFileRoute } from "@tanstack/react-router";
import {
  sendNuncaAcessou,
  sendSemAcesso4Dias,
  sendWhatsApp,
} from "@/services/zApiService";

// Verifica se o CTR do aluno termina no dígito do grupo (0-9)
function alunoNoGrupo(ctr: number | null | undefined, grupo: number): boolean {
  if (ctr == null) return false;
  return Math.abs(ctr) % 10 === grupo;
}

function calcularDiaDisparo(dataUltimoAcesso: Date): Date {
  const data = new Date(dataUltimoAcesso);
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + 4);
  while (data.getDay() === 0 || data.getDay() === 6) {
    data.setDate(data.getDate() + 1);
  }
  return data;
}

function mesmaData(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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
          grupo = Number(body?.grupo ?? 0) % 10;
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

        // Excluir alunos que já finalizaram a prova (qualquer resultado não-nulo)
        const { data: alunosComResultado } = await supabaseAdmin
          .from("prova_agendamentos")
          .select("ctr")
          .not("resultado", "is", null);
        const ctrsFinalizados = new Set(
          (alunosComResultado ?? [])
            .map((a: any) => (a.ctr == null ? null : Number(a.ctr)))
            .filter((v: number | null) => v != null),
        );

        const alunosGrupo = (alunos ?? [])
          .filter((a) => alunoNoGrupo(a.ctr == null ? null : Number(a.ctr), grupo))
          .filter((a) => !ctrsFinalizados.has(Number(a.ctr)));

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
            .select("created_at, aulas:aula_id(titulo, cursos:curso_id(nome))")
            .eq("aluno_id", alunoId)
            .order("created_at", { ascending: false })
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
                    alunoId: aluno.id,
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

          // 2) Sem acesso: dispara no dia calculado (4 dias corridos, adiando fim de semana p/ segunda)
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
                const ultimoAcesso = new Date(ultSess.login_em);
                const diaDisparo = calcularDiaDisparo(ultimoAcesso);
                if (mesmaData(diaDisparo, hojeBR)) {
                  const { aula, materia } = await ultimaAula(aluno.id);
                  const diasCorridos = Math.floor(
                    (hojeBR.getTime() - ultimoAcesso.getTime()) / 86400000,
                  );
                  await sendSemAcesso4Dias({
                    telefone: aluno.telefone,
                    nome: aluno.nome,
                    dias: diasCorridos,
                    ultimaAula: aula,
                    materia,
                    alunoId: aluno.id,
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


          // 3) Fim de semana — ciclos progressivos (sábado/domingo)
          if (dow === 6 || dow === 0) {
            const diaLabel: "sabado" | "domingo" = dow === 6 ? "sabado" : "domingo";
            try {
              // Toggle global
              const { data: cfg } = await supabaseAdmin
                .from("configuracoes")
                .select("valor")
                .eq("chave", `zapi_disparo_${diaLabel}`)
                .maybeSingle();
              const enabled = !cfg || cfg.valor !== "false";
              if (!enabled) continue;

              // Ciclo com base na data da matrícula (usa created_at do aluno)
              const dataMatricula = new Date(aluno.created_at as string);
              const semanas = Math.floor(
                (hojeBR.getTime() - dataMatricula.getTime()) / (7 * 24 * 60 * 60 * 1000),
              );
              const ciclo = semanas + 1;
              if (ciclo < 1 || ciclo > 6) continue;

              // Assistiu >=70% em pelo menos 1 aula nos últimos 7 dias?
              const seteDiasAtras = new Date(hojeBR.getTime() - 7 * 24 * 60 * 60 * 1000);
              const { count: assistidasCount } = await supabaseAdmin
                .from("aluno_aulas_assistidas")
                .select("id", { count: "exact", head: true })
                .eq("aluno_id", aluno.id)
                .gte("percentual_assistido", 70)
                .gte("assistida_em", seteDiasAtras.toISOString());
              const assistiu = (assistidasCount ?? 0) > 0;

              // Busca mensagem
              const { data: msgRow } = await supabaseAdmin
                .from("zapi_mensagens_fds")
                .select("mensagem")
                .eq("dia", diaLabel)
                .eq("ciclo", ciclo)
                .eq("assistiu", assistiu)
                .maybeSingle();
              if (!msgRow?.mensagem) continue;

              const primeiroNome =
                (aluno.nome || "").trim().split(/\s+/)[0] || "";
              const nomeFmt = primeiroNome
                ? primeiroNome.charAt(0).toUpperCase() +
                  primeiroNome.slice(1).toLowerCase()
                : "";
              const mensagem = msgRow.mensagem.replace(/\[nome\]/gi, nomeFmt);

              await sendWhatsApp(aluno.telefone, mensagem, {
                alunoId: aluno.id,
                tipo: `${diaLabel}_ciclo_${ciclo}` as any,
              });

              if (diaLabel === "sabado") result.sabado++;
              else result.domingo++;
            } catch (e: any) {
              result.erros.push(`${diaLabel} ${aluno.id}: ${e.message}`);
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
