import { supabase } from "@/integrations/supabase/client";

/**
 * Sistema de gamificação "Milhas EJA".
 * Cada função é idempotente — o backend (add_milhas_eja) ignora créditos
 * já registrados em milhas_eja_controle.
 */

export function calcNivel(pontos: number): string {
  if (pontos >= 1201) return "🏆 Destaque";
  if (pontos >= 701) return "⭐ Dedicado";
  if (pontos >= 451) return "📚 Estudante";
  return "🌱 Iniciante";
}

export interface MilhasGanhouEvent {
  pontos: number;
  tipo: string;
  novoTotal: number;
  novoNivel: string;
  subiuNivel: boolean;
  nivelAnterior: string;
}

async function addPontos(
  alunoId: string,
  pontos: number,
  tipo: string,
  descricao: string,
  referenciaId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("add_milhas_eja", {
      p_aluno_id: alunoId,
      p_pontos: pontos,
      p_tipo: tipo,
      p_descricao: descricao,
      p_referencia_id: referenciaId,
    });
    if (error) {
      console.warn("[milhas] add_milhas_eja error:", error.message);
      return false;
    }
    if (data && typeof window !== "undefined") {
      try {
        const { data: saldo } = await supabase
          .from("milhas_eja")
          .select("pontos_total, nivel")
          .eq("aluno_id", alunoId)
          .maybeSingle();
        const novoTotal = saldo?.pontos_total ?? pontos;
        const novoNivel = saldo?.nivel ?? calcNivel(novoTotal);
        const nivelAnterior = calcNivel(Math.max(0, novoTotal - pontos));
        const detail: MilhasGanhouEvent = {
          pontos,
          tipo,
          novoTotal,
          novoNivel,
          nivelAnterior,
          subiuNivel: nivelAnterior !== novoNivel,
        };
        window.dispatchEvent(new CustomEvent("milhas:ganhou", { detail }));
      } catch {
        /* noop */
      }
    }
    return Boolean(data);
  } catch (e) {
    console.warn("[milhas] falha rpc:", e);
    return false;
  }
}

function hojeBrasilia(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** A) +50 no primeiro login */
export function creditarPrimeiroLogin(alunoId: string) {
  return addPontos(alunoId, 50, "primeiro_login", "Primeiro login na plataforma", "unico");
}

/** B) +30 ao atingir 70% em uma aula (uma vez por aula) */
export function creditarAulaAssistida(alunoId: string, aulaId: string) {
  return addPontos(alunoId, 30, "assistiu_aula", "Concluiu uma aula (70%+)", aulaId);
}

/** C) +100 ao completar 3 aulas no mesmo dia (Brasília) */
export async function checarBonus3AulasNoDia(alunoId: string) {
  const hoje = hojeBrasilia();
  const inicio = `${hoje}T03:00:00.000Z`; // 00h Brasília
  const fim = `${hoje}T26:59:59.999Z`;
  const { count } = await supabase
    .from("aluno_aulas_assistidas")
    .select("id", { count: "exact", head: true })
    .eq("aluno_id", alunoId)
    .gte("percentual_assistido", 70)
    .gte("created_at", inicio)
    .lte("created_at", fim);
  if ((count ?? 0) >= 3) {
    return addPontos(alunoId, 100, "bonus_3_aulas", "Bônus: 3 aulas no mesmo dia", hoje);
  }
  return false;
}

/** D) +250 ao completar todas as aulas de um curso (>=70% em cada) */
export async function checarCursoCompleto(alunoId: string, cursoId: string) {
  const { count: total } = await supabase
    .from("aulas")
    .select("id", { count: "exact", head: true })
    .eq("curso_id", cursoId);
  if (!total || total === 0) return false;

  const { count: feitas } = await supabase
    .from("aluno_aulas_assistidas")
    .select("id", { count: "exact", head: true })
    .eq("aluno_id", alunoId)
    .eq("curso_id", cursoId)
    .gte("percentual_assistido", 70);

  if ((feitas ?? 0) >= total) {
    return addPontos(alunoId, 250, "completou_materia", "Concluiu todas as aulas da matéria", cursoId);
  }
  return false;
}

/** E) +150 a cada 7 dias seguidos de login (idempotente via SQL) */
export async function checar7DiasLogin(alunoId: string) {
  const { data, error } = await supabase.rpc("check_7_dias_login_milhas", {
    p_aluno_id: alunoId,
  });
  if (error) {
    console.warn("[milhas] check_7_dias_login_milhas:", error.message);
    return false;
  }
  return Boolean(data);
}
