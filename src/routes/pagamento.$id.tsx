import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/pagamento/$id")({
  component: PagamentoPage,
});

function PagamentoPage() {
  const { id } = Route.useParams();

  const { data: matricula, isLoading } = useQuery({
    queryKey: ["pagamento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas_aulao" as any)
        .select("id, nome, cpf, telefone, forma_pagamento, pagamento_status, assinatura_nome")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const [cartao, setCartao] = useState({ holderName: "", number: "", expiryMonth: "", expiryYear: "", ccv: "" });
  const [parcelas, setParcelas] = useState(12);
  const [pagLoading, setPagLoading] = useState(false);
  const [pagResult, setPagResult] = useState<any>(null);
  const [pagErro, setPagErro] = useState<string | null>(null);

  const gerarPagamento = async () => {
    setPagLoading(true);
    setPagErro(null);
    try {
      const res = await fetch("/api/public/hooks/asaas-aulao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: id,
          billing_type: "CREDIT_CARD",
          installment_count: parcelas,
          credit_card: cartao,
          credit_card_holder_info: {
            name: matricula?.nome || cartao.holderName,
            cpfCnpj: (matricula?.cpf || "").replace(/\D/g, ""),
            phone: (matricula?.telefone || "").replace(/\D/g, ""),
            postalCode: "88058512",
            addressNumber: "65",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao processar pagamento");
      setPagResult(data);
    } catch (e: any) {
      setPagErro(e.message || "Erro ao processar pagamento");
    } finally {
      setPagLoading(false);
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

  if (matricula.pagamento_status === "confirmado") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">Pagamento já realizado! ✅</h1>
            <p className="text-muted-foreground">Seu pagamento já foi confirmado. Nossa equipe entrará em contato pelo WhatsApp.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pagResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">
              {pagResult.credit_card_status === "CONFIRMED" || pagResult.credit_card_status === "RECEIVED"
                ? "Pagamento aprovado! 🎉"
                : "Pagamento em processamento"}
            </h1>
            <p className="text-muted-foreground">
              {pagResult.credit_card_status === "CONFIRMED" || pagResult.credit_card_status === "RECEIVED"
                ? "Seu pagamento foi aprovado! Nossa equipe entrará em contato pelo WhatsApp para liberar seu acesso às aulas."
                : "O pagamento está sendo processado. Você receberá a confirmação em breve pelo WhatsApp."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primeiroNome = matricula.nome?.split(" ")[0] || "Aluno";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Olá, {primeiroNome}! 🎓</h1>
            <p className="text-muted-foreground text-sm">
              Complete seu pagamento no cartão de crédito em até 12x sem juros para garantir sua vaga e
              concluir seus estudos em <strong>menos de 6 meses</strong>.
            </p>
          </div>

          {pagErro && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{pagErro}</div>
          )}

          <div className="space-y-2">
            <div>
              <Label>Nome no cartão</Label>
              <Input
                value={cartao.holderName}
                onChange={(e) => setCartao({ ...cartao, holderName: e.target.value })}
                placeholder="Nome como está no cartão"
              />
            </div>
            <div>
              <Label>Número do cartão</Label>
              <Input
                value={cartao.number}
                onChange={(e) => setCartao({ ...cartao, number: e.target.value.replace(/\D/g, "").slice(0, 16) })}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Mês</Label>
                <Input
                  value={cartao.expiryMonth}
                  onChange={(e) => setCartao({ ...cartao, expiryMonth: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="MM"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>Ano</Label>
                <Input
                  value={cartao.expiryYear}
                  onChange={(e) => setCartao({ ...cartao, expiryYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="AAAA"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>CVV</Label>
                <Input
                  value={cartao.ccv}
                  onChange={(e) => setCartao({ ...cartao, ccv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="123"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <Label>Parcelas</Label>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {[12,11,10,9,8,7,6,5,4,3,2,1].map((n) => {
                  const valorParcela = (1438.80 / n).toFixed(2).replace(".", ",");
                  return <option key={n} value={n}>{n}x de R$ {valorParcela} — Sem Juros</option>;
                })}
              </select>
            </div>
          </div>
          <Button
            className="w-full text-base py-5"
            onClick={gerarPagamento}
            disabled={pagLoading || !cartao.holderName || !cartao.number || !cartao.expiryMonth || !cartao.expiryYear || !cartao.ccv}
          >
            {pagLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
            ) : (
              "✅ Confirmar Pagamento"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
