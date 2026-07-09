import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export type AlunoStatus = "ativo" | "inadimplente" | "trancado" | "formado" | "inativo";

export const STATUS_LIST: AlunoStatus[] = ["ativo", "inadimplente", "trancado", "formado", "inativo"];

export const STATUS_CONFIG: Record<AlunoStatus, { label: string; className: string }> = {
  ativo:         { label: "Ativo",         className: "bg-green-500 text-white hover:bg-green-600" },
  inadimplente:  { label: "Inadimplente",  className: "bg-red-500 text-white hover:bg-red-600" },
  trancado:      { label: "Trancado",      className: "bg-yellow-500 text-white hover:bg-yellow-600" },
  formado:       { label: "Formado 🎓",    className: "bg-blue-500 text-white hover:bg-blue-600" },
  inativo:       { label: "Inativo",       className: "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200" },
};

export function StatusAlunoBadge({ status }: { status?: string | null }) {
  const key = (status as AlunoStatus) || "ativo";
  const cfg = STATUS_CONFIG[key] ?? STATUS_CONFIG.ativo;
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

/**
 * Verifica parcelas em atraso > 7 dias e ajusta status do aluno automaticamente.
 * Não altera status trancado/formado/inativo.
 */
export async function verificarInadimplenciaAuto(alunoId: string, statusAtual?: string | null) {
  if (!alunoId) return;
  if (statusAtual === "trancado" || statusAtual === "formado" || statusAtual === "inativo") return;

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("id")
    .eq("aluno_id", alunoId);

  const matriculaIds = (matriculas ?? []).map((m: any) => m.id);
  if (matriculaIds.length === 0) return;

  const limite = new Date();
  limite.setDate(limite.getDate() - 7);
  const limiteStr = limite.toISOString().slice(0, 10);

  const { data: atrasadas } = await supabase
    .from("parcelas")
    .select("id")
    .in("matricula_id", matriculaIds)
    .neq("status", "pago")
    .neq("status", "isento")
    .lt("data_vencimento", limiteStr)
    .limit(1);

  const temAtraso = (atrasadas ?? []).length > 0;
  const novoStatus: AlunoStatus = temAtraso ? "inadimplente" : "ativo";

  if (novoStatus !== statusAtual) {
    await supabase.from("alunos").update({ status: novoStatus }).eq("id", alunoId);
  }
}
