import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { maskCPF } from "@/lib/format";

export const Route = createFileRoute("/contrato/$id")({
  component: ContratoPage,
});

function ContratoPage() {
  const { id } = Route.useParams();

  const { data: matricula, isLoading, refetch } = useQuery({
    queryKey: ["contrato-publico", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas_aulao" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: modelo } = useQuery({
    queryKey: ["contrato-modelo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("modelos_contrato" as any)
        .select("id, conteudo_html")
        .eq("ativo", true)
        .limit(1)
        .single();
      return data as any;
    },
  });

  const [assinatura, setAssinatura] = useState("");
  const [confirmacaoCpf, setConfirmacaoCpf] = useState("");
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const contratoHtml = useMemo(() => {
    if (!modelo?.conteudo_html || !matricula) return null;
    const formaLabel = matricula.forma_pagamento === "boleto" ? "Boleto Bancário" : "Cartão de Crédito";
    const plano = matricula.forma_pagamento === "boleto"
      ? { entrada: "69,90", parcelasExibicao: "1 + 9", valorParc: "159,90", total: "1.668,90" }
      : { entrada: "69,90", parcelasExibicao: "12", valorParc: "119,90", total: "1.508,70" };

    const variables: Record<string, string> = {
      "[NOME_ALUNO]": matricula.nome || "",
      "[CPF_ALUNO]": matricula.cpf || "",
      "[TELEFONE_ALUNO]": matricula.telefone || "",
      "[FORMA_PAGAMENTO]": formaLabel,
      "[VALOR_ENTRADA]": `R$ ${plano.entrada}`,
      "[VALOR_PARCELA]": `R$ ${plano.valorParc}`,
      "[NUMERO_PARCELAS]": plano.parcelasExibicao,
      "[VALOR_TOTAL]": `R$ ${plano.total}`,
      "[DATA_MATRICULA]": new Date().toLocaleDateString("pt-BR"),
      "[NOME_ESCOLA]": "Soluções Online",
      "[DATA_HOJE]": new Date().toLocaleDateString("pt-BR"),
      "[DATA_PRIMEIRA_PARCELA]": (() => {
        const d = new Date();
        if (matricula.forma_pagamento === "boleto") d.setDate(d.getDate() + 30);
        return d.toLocaleDateString("pt-BR");
      })(),
    };
    let html = modelo.conteudo_html;
    Object.entries(variables).forEach(([k, v]) => {
      html = html.replaceAll(k, v);
    });
    return html;
  }, [modelo, matricula]);

  const handleAssinar = async () => {
    if (!aceito) { toast.error("Aceite o contrato para continuar"); return; }
    if (!matricula) return;
    if (assinatura.trim().toLowerCase() !== matricula.nome.trim().toLowerCase()) {
      toast.error("Digite seu nome completo exatamente como no cadastro");
      return;
    }
    if (confirmacaoCpf.trim() !== matricula.cpf.trim()) {
      toast.error("O CPF de confirmação não confere");
      return;
    }

    setEnviando(true);
    try {
      const agora = new Date();
      const dataHoraAssinatura = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const hashBase = `${matricula.cpf}-${assinatura.trim()}-${agora.toISOString()}`;
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashBase));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16).toUpperCase();
      const codigoValidacao = `SOL-${hashHex}`;
      const formaLabel = matricula.forma_pagamento === "boleto" ? "Boleto Bancário" : "Cartão de Crédito";

      const blocoValidacao = `
<div style="margin-top:40px;padding:16px;border:2px solid #1a1a2e;border-radius:8px;background:#f8f9fa;font-size:12px;line-height:1.6;">
  <div style="text-align:center;margin-bottom:12px;">
    <strong style="font-size:14px;color:#1a1a2e;">✅ CONTRATO ASSINADO DIGITALMENTE</strong>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:4px 8px;color:#555;width:40%;">Assinado por:</td><td style="padding:4px 8px;"><strong>${assinatura.trim()}</strong></td></tr>
    <tr><td style="padding:4px 8px;color:#555;">CPF do signatário:</td><td style="padding:4px 8px;"><strong>${matricula.cpf}</strong></td></tr>
    <tr><td style="padding:4px 8px;color:#555;">Data e hora:</td><td style="padding:4px 8px;"><strong>${dataHoraAssinatura}</strong></td></tr>
    <tr><td style="padding:4px 8px;color:#555;">Código de validação:</td><td style="padding:4px 8px;font-family:monospace;"><strong>${codigoValidacao}</strong></td></tr>
    <tr><td style="padding:4px 8px;color:#555;">Forma de pagamento:</td><td style="padding:4px 8px;"><strong>${formaLabel}</strong></td></tr>
  </table>
  <div style="margin-top:12px;padding-top:8px;border-top:1px solid #ddd;color:#777;font-size:10px;text-align:center;">
    Este contrato foi assinado eletronicamente conforme MP 2.200-2/2001 e art. 784, §4º do CPC.<br>
    A autenticidade pode ser verificada pelo código acima junto à Escola Soluções Online.
  </div>
</div>`;

      const { error } = await supabase.from("matriculas_aulao" as any).update({
        contrato_html: (contratoHtml || "") + blocoValidacao,
        assinatura_nome: assinatura.trim(),
        assinado_em: agora.toISOString(),
      }).eq("id", id);

      if (error) throw error;
      setSucesso(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar assinatura");
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!matricula) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center">
            <p className="text-muted-foreground">Matrícula não encontrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (matricula.assinatura_nome || sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">Contrato assinado com sucesso! ✅</h1>
            <p className="text-muted-foreground">Obrigado! Nossa equipe entrará em contato pelo WhatsApp.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primeiroNome = matricula.nome?.split(" ")[0] || "Aluno";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Olá, {primeiroNome}! 🎓</h1>
          <p className="text-muted-foreground text-sm">
            Leia o contrato abaixo e assine digitalmente para confirmar sua matrícula.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-bold">Contrato de Matrícula</h2>
            <div
              className="border rounded p-4 max-h-64 overflow-y-auto bg-gray-50 text-sm prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: contratoHtml || "<p>Carregando contrato...</p>" }}
            />

            <div className="flex items-start gap-2">
              <Checkbox
                id="aceito-contrato"
                checked={aceito}
                onCheckedChange={(v) => setAceito(!!v)}
              />
              <label htmlFor="aceito-contrato" className="text-sm cursor-pointer">
                Li e aceito todas as cláusulas do contrato
              </label>
            </div>

            <div>
              <Label>Assinatura digital (digite seu nome completo)</Label>
              <Input
                value={assinatura}
                onChange={(e) => setAssinatura(e.target.value)}
                placeholder={matricula.nome}
              />
            </div>
            <div>
              <Label>Confirme seu CPF</Label>
              <Input
                value={confirmacaoCpf}
                onChange={(e) => setConfirmacaoCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>

            <Button
              className="w-full text-base py-5 bg-green-600 hover:bg-green-700"
              onClick={handleAssinar}
              disabled={enviando || !aceito}
            >
              {enviando ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Assinando...</>
              ) : (
                "✅ Assinar Contrato"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
