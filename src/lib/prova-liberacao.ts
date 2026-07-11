import { supabase } from "@/integrations/supabase/client";

export type LiberacaoResult = {
  liberada: boolean;
  motivo: "acelerado" | "agendamento" | "prazo" | "aguardando";
  dataLiberacao?: Date;
  agendamento?: any;
};

/**
 * Verificação centralizada da liberação da prova final.
 * Deve ser usada em TODOS os pontos que decidem se o aluno pode
 * acessar a prova (dashboard, rota da prova, guards, etc).
 *
 * Regras:
 * 1. Pacote Acelerado → sempre liberada.
 * 2. Existe prova_agendamentos (agendado/agendada) com resultado NULL
 *    e data_prova <= hoje → liberada.
 * 3. Caso contrário, libera após 60 dias da matrícula.
 */
export async function verificarLiberacaoProva(params: {
  alunoId: string;
  alunoCtr?: string | null;
  dataLiberacaoProva?: string | null;
}): Promise<LiberacaoResult> {
  const { alunoId, alunoCtr, dataLiberacaoProva } = params;

  // 1) Acelerado?
  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("id, created_at")
    .eq("aluno_id", alunoId);

  const matriculaIds = (matriculas ?? []).map((m: any) => m.id);
  if (matriculaIds.length > 0) {
    const { data: parcela } = await supabase
      .from("parcelas")
      .select("tipo_pacote")
      .in("matricula_id", matriculaIds)
      .eq("numero", 1)
      .eq("tipo", "parcela")
      .limit(1)
      .maybeSingle();
    const tipo = (parcela as any)?.tipo_pacote?.toString().toLowerCase() || "";
    if (tipo.includes("acelerado")) {
      return { liberada: true, motivo: "acelerado" };
    }
  }

  // 2) Prova agendada com data já chegada?
  const hojeStr = new Date().toISOString().slice(0, 10);
  let agQuery = supabase
    .from("prova_agendamentos")
    .select("*")
    .in("status", ["agendado", "agendada"])
    .is("resultado", null)
    .lte("data_prova", hojeStr)
    .order("data_prova", { ascending: false })
    .limit(1);

  if (alunoCtr) {
    agQuery = agQuery.or(`aluno_id.eq.${alunoId},ctr.eq.${alunoCtr}`);
  } else {
    agQuery = agQuery.eq("aluno_id", alunoId);
  }

  const { data: agendamento } = await agQuery.maybeSingle();
  if (agendamento) {
    return { liberada: true, motivo: "agendamento", agendamento };
  }

  // 3) Regra dos 60 dias
  let prazo: Date | undefined;
  if (dataLiberacaoProva) {
    prazo = new Date(dataLiberacaoProva);
  } else if (matriculas && matriculas.length > 0) {
    prazo = new Date((matriculas[0] as any).created_at);
    prazo.setDate(prazo.getDate() + 60);
  }

  if (!prazo) return { liberada: false, motivo: "aguardando" };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const p = new Date(prazo);
  p.setHours(0, 0, 0, 0);

  return {
    liberada: hoje.getTime() >= p.getTime(),
    motivo: "prazo",
    dataLiberacao: p,
  };
}
