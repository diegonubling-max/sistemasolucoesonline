import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/PageHeader";
import { Users, CreditCard, Landmark, TrendingUp, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_admin/dashboard-aulao")({
  head: () => ({ meta: [{ title: "Dashboard Aulão — Soluções Online" }] }),
  component: DashboardAulao,
});

const VALOR_BOLETO_TOTAL = 1668.90;
const VALOR_BOLETO_TAXA = 69.90;
const VALOR_CARTAO_TOTAL = 1438.80;

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DashboardAulao() {
  const { data: matriculas, isLoading } = useQuery({
    queryKey: ["dashboard-aulao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas_aulao" as any)
        .select("*")
        .neq("status", "cancelado");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const total = matriculas?.length ?? 0;
  const boletos = matriculas?.filter((m) => m.forma_pagamento === "boleto") ?? [];
  const cartoes = matriculas?.filter((m) => m.forma_pagamento === "cartao") ?? [];

  const totalBoleto = boletos.length;
  const totalCartao = cartoes.length;

  const boletosPagos = boletos.filter((m) => m.pagamento_status === "confirmado");
  const cartoesPagos = cartoes.filter((m) => m.pagamento_status === "confirmado");

  const faturamentoBoleto = totalBoleto * VALOR_BOLETO_TOTAL;
  const faturamentoCartao = totalCartao * VALOR_CARTAO_TOTAL;
  const faturamentoTotal = faturamentoBoleto + faturamentoCartao;

  const recebidoBoleto = boletosPagos.length * VALOR_BOLETO_TAXA;
  const recebidoCartao = cartoesPagos.length * VALOR_CARTAO_TOTAL;
  const recebidoTotal = recebidoBoleto + recebidoCartao;

  const assinaram = matriculas?.filter((m) => m.assinatura_nome) ?? [];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard Aulão" description="Carregando..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard Aulão"
        description="Visão geral de matrículas e faturamento do Aulão"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Matrículas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {assinaram.length} contrato(s) assinado(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(faturamentoTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {total} matrícula(s) × valor por plano
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-blue-600" /> Boleto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{totalBoleto}</div>
                <p className="text-xs text-muted-foreground">Matrículas</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{fmt(faturamentoBoleto)}</div>
                <p className="text-xs text-muted-foreground">Faturamento ({totalBoleto} × {fmt(VALOR_BOLETO_TOTAL)})</p>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Pagos (taxa R$ 69,90)</span>
                <span className="font-semibold text-green-700">{boletosPagos.length} de {totalBoleto}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Recebido</span>
                <span className="font-semibold text-green-700">{fmt(recebidoBoleto)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${totalBoleto > 0 ? (boletosPagos.length / totalBoleto) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" /> Cartão de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{totalCartao}</div>
                <p className="text-xs text-muted-foreground">Matrículas</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{fmt(faturamentoCartao)}</div>
                <p className="text-xs text-muted-foreground">Faturamento ({totalCartao} × {fmt(VALOR_CARTAO_TOTAL)})</p>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Pagos (12x R$ 119,90)</span>
                <span className="font-semibold text-green-700">{cartoesPagos.length} de {totalCartao}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Recebido</span>
                <span className="font-semibold text-green-700">{fmt(recebidoCartao)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${totalCartao > 0 ? (cartoesPagos.length / totalCartao) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
