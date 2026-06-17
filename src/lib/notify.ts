import { supabase } from "@/integrations/supabase/client";

export async function sendPushNotification(title: string, body: string) {
  try {
    await supabase.functions.invoke("send-push", {
      body: { title, body },
    });
  } catch (e) {
    console.error("sendPushNotification error:", e);
  }
}

export async function notifyPagamentoRecebido(parcelaId: string, valor: number, formaPagamento: string) {
  try {
    const { data: p } = await supabase
      .from("parcelas")
      .select("matricula_id, polo_id, matriculas:matricula_id(aluno_id, alunos:aluno_id(nome)), polos:polo_id(nome)")
      .eq("id", parcelaId)
      .maybeSingle();
    const alunoNome = (p as any)?.matriculas?.alunos?.nome ?? "—";
    const poloNome = (p as any)?.polos?.nome ?? "—";
    const valorFmt = Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    sendPushNotification(
      "💰 Pagamento Recebido!",
      `Aluno: ${alunoNome} | Polo: ${poloNome} | Valor: ${valorFmt} | Forma: ${formaPagamento}`,
    );
  } catch (e) {
    console.error("notifyPagamentoRecebido error:", e);
  }
}
