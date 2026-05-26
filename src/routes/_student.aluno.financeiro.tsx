import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  Receipt,
  CreditCard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_student/aluno/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — EduManager" }] }),
  component: StudentFinance,
});

function StudentFinance() {
  const { session } = useAuth();

  const { data: financeData, isLoading } = useQuery({
    queryKey: ["student-finance", session?.user.email],
    queryFn: async () => {
      // 1. Find student by email
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", session?.user.email ?? "")
        .single();
      
      if (!aluno) return null;

      // 2. Find enrollment
      const { data: matricula } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", aluno.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!matricula) return { parcelas: [] };

      // 3. Find installments
      const { data: parcelas, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("matricula_id", matricula.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return { parcelas: parcelas || [] };
    },
    enabled: !!session?.user.email,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string, vencimento: string) => {
    if (status === 'pago') {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none flex items-center gap-1 w-fit">
          <CheckCircle2 className="h-3 w-3" /> Pago
        </Badge>
      );
    }
    if (status === 'isento') {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none w-fit">
          Isento
        </Badge>
      );
    }

    const isVencido = isBefore(new Date(vencimento), startOfDay(new Date()));
    if (isVencido || status === 'vencido') {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none w-fit">
          Vencido
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-none w-fit">
        Em aberto
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string, parcelasCartao?: number) => {
    if (!method) return null;
    
    if (method.toLowerCase().includes('cartão')) {
      const label = parcelasCartao ? `Cartão ${parcelasCartao}x` : 'Cartão';
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none">
          {label}
        </Badge>
      );
    }
    if (method.toLowerCase().includes('pix')) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
          PIX
        </Badge>
      );
    }
    if (method.toLowerCase().includes('boleto')) {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
          Boleto
        </Badge>
      );
    }
    return <span className="text-sm text-muted-foreground">{method}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const parcelas = financeData?.parcelas || [];
  
  const totalPago = parcelas
    .filter(p => p.status === 'pago')
    .reduce((acc, p) => acc + Number(p.valor), 0);
  
  const totalEmAberto = parcelas
    .filter(p => p.status === 'aberto' || p.status === 'vencido')
    .reduce((acc, p) => acc + Number(p.valor), 0);
    
  const totalContrato = parcelas
    .filter(p => p.status !== 'isento')
    .reduce((acc, p) => acc + Number(p.valor), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground">Acompanhe seu histórico de pagamentos e mensalidades</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pago</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPago)}</div>
          </CardContent>
          <div className="h-1 bg-green-500 w-full" />
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Aberto</CardTitle>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalEmAberto)}</div>
          </CardContent>
          <div className="h-1 bg-yellow-500 w-full" />
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total do Contrato</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalContrato)}</div>
          </CardContent>
          <div className="h-1 bg-blue-500 w-full" />
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Histórico de Cobranças
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-100">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="font-semibold">Descrição</TableHead>
                  <TableHead className="font-semibold">Vencimento</TableHead>
                  <TableHead className="font-semibold">Valor</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhuma cobrança encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  parcelas.map((parcela) => {
                    const status = parcela.status;
                    const isPago = status === 'pago';
                    const isVencido = isBefore(new Date(parcela.data_vencimento), startOfDay(new Date())) && status === 'aberto';
                    
                    return (
                      <TableRow key={parcela.id} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-medium">
                          {parcela.descricao || (parcela.tipo === 'taxa_matricula' ? 'Taxa de Matrícula' : `Parcela ${parcela.numero}`)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(parcela.data_vencimento), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(Number(parcela.valor))}
                        </TableCell>
                        <TableCell className="text-center flex justify-center">
                          {getStatusBadge(status, parcela.data_vencimento)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isPago ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-green-600 font-medium">
                                Pago em {parcela.data_pagamento ? format(new Date(parcela.data_pagamento), "dd/MM/yyyy") : '--/--/----'}
                              </span>
                              {getPaymentMethodBadge(parcela.forma_pagamento, parcela.parcelas_cartao)}
                            </div>
                          ) : status === 'isento' ? (
                            <span className="text-xs text-muted-foreground italic">Isentado pelo administrador</span>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" disabled className="h-8 gap-1.5 opacity-60">
                                      <Lock className="h-3 w-3" /> Boleto
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Disponível em breve</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" disabled className="h-8 gap-1.5 opacity-60">
                                      <Lock className="h-3 w-3" /> PIX
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Disponível em breve</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
