import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/services/pushNotificationService";

export { sendPushNotification };

export async function notifyPagamentoRecebido(parcelaId: string, valor: number, formaPagamento: string) {
  try {
    const { data: p } = await supabase
      .from("parcelas")
      .select("matricula_id, polo_id, matriculas:matricula_id(aluno_id, alunos:aluno_id(id, nome, telefone)), polos:polo_id(nome)")
      .eq("id", parcelaId)
      .maybeSingle();
    const alunoNome = (p as any)?.matriculas?.alunos?.nome ?? "—";
    const alunoTelefone = (p as any)?.matriculas?.alunos?.telefone ?? "";
    const alunoId = (p as any)?.matriculas?.alunos?.id ?? null;
    const poloNome = (p as any)?.polos?.nome ?? "—";
    const valorFmt = Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    await sendPushNotification(
      "💰 Pagamento Recebido!",
      `Aluno: ${alunoNome} | Polo: ${poloNome} | Valor: ${valorFmt} | Forma: ${formaPagamento}`,
    );
    // WhatsApp confirmação de pagamento
    try {
      if (alunoTelefone) {
        const { sendConfirmacaoPagamento } = await import("@/services/zApiService");
        await sendConfirmacaoPagamento({ telefone: alunoTelefone, nome: alunoNome, valor, alunoId });
      }
    } catch (waErr) {
      console.error("WhatsApp confirmação erro:", waErr);
    }

  } catch (e) {
    console.error("notifyPagamentoRecebido error:", e);
  }
}

export async function notifyNovaMatricula(matriculaId: string) {
  try {
    const { data: m } = await supabase
      .from("matriculas")
      .select("aluno_id, colaborador_id, alunos:aluno_id(nome, polo_id, polos:polo_id(nome)), colaboradores:colaborador_id(nome)")
      .eq("id", matriculaId)
      .maybeSingle();
    const alunoNome = (m as any)?.alunos?.nome ?? "—";
    const poloNome = (m as any)?.alunos?.polos?.nome ?? "—";
    const vendedoraNome = (m as any)?.colaboradores?.nome ?? "N/A";
    await sendPushNotification(
      "🎉 Nova Matrícula!",
      `Aluno: ${alunoNome} | Polo: ${poloNome} | Vendedora: ${vendedoraNome}`,
    );
  } catch (e) {
    console.error("notifyNovaMatricula error:", e);
  }
}
