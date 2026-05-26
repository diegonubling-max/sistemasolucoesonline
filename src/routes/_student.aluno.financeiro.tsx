import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, DollarSign, Wallet, Calendar, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/aluno/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Soluções Online" }] }),
  component: StudentFinance,
});

function StudentFinance() {
  const { session } = useAuth();

  const { data: parcelas, isLoading } = useQuery({
    queryKey: ["student-finance", session?.user.email],
    queryFn: async () => {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", session?.user.email ?? "")
        .single();
      
      if (!aluno) return [];

      const { data: ms } = await supabase.from("matriculas").select("id").eq("aluno_id", aluno.id);
      const ids = (ms ?? []).map((m) => m.id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .in("matricula_id", ids)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session?.user.email,
  });

  const totalPago = parcelas?.filter(p => p.status === 'pago').reduce((acc, p) => acc + Number(p.valor), 0) || 0;
  const totalAberto = parcelas?.filter(p => p.status === 'aberto').reduce((acc, p) => acc + Number(p.valor), 0) || 0;
  const totalGeral = parcelas?.filter(p => p.status !== 'isento').reduce((acc, p) => acc + Number(p.valor), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-40 bg-[#141414] min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-[#2D6ADF]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-10 text-white font-sans bg-[#141414]">
      <div className="flex items-center gap-3 border-l-4 border-[#2D6ADF] pl-4">
        <DollarSign className="h-8 w-8 text-[#2D6ADF]" />
        <h1 className="text-3xl font-black tracking-tighter">Financeiro</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-[#1e1e1e] border-white/5 shadow-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-[#B3B3B3] font-medium uppercase tracking-widest">Total Pago</p>
            <p className="text-3xl font-black text-green-500 mt-1">R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1e1e1e] border-white/5 shadow-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-[#B3B3B3] font-medium uppercase tracking-widest">Em Aberto</p>
            <p className="text-3xl font-black text-yellow-500 mt-1">R$ {totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1e1e1e] border-white/5 shadow-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-[#B3B3B3] font-medium uppercase tracking-widest">Total Geral</p>
            <p className="text-3xl font-black text-[#2D6ADF] mt-1">R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="bg-[#1e1e1e] border-white/5 shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-black/20">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#2D6ADF]" />
            Minhas Cobranças
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[#B3B3B3] font-bold uppercase tracking-widest text-xs">Descrição</TableHead>
                  <TableHead className="text-[#B3B3B3] font-bold uppercase tracking-widest text-xs text-center">Vencimento</TableHead>
                  <TableHead className="text-[#B3B3B3] font-bold uppercase tracking-widest text-xs text-center">Valor</TableHead>
                  <TableHead className="text-[#B3B3B3] font-bold uppercase tracking-widest text-xs text-center">Status</TableHead>
                  <TableHead className="text-[#B3B3B3] font-bold uppercase tracking-widest text-xs text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas?.map((p, index) => {
                  const isVencido = p.status === 'aberto' && isBefore(startOfDay(new Date(p.data_vencimento)), startOfDay(new Date()));
                  const description = p.tipo === 'taxa_matricula' ? 'Taxa de Matrícula' : `Parcela ${p.numero}`;
                  
                  return (
                    <TableRow key={p.id} className={cn(
                      "border-white/5 transition-colors",
                      index % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#1a1a1a]",
                      "hover:bg-white/5"
                    )}>
                      <td className="py-5 font-bold">{description}</td>
                      <td className="py-5 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#B3B3B3]">
                          <Calendar className="h-4 w-4" />
                          {formatDate(p.data_vencimento)}
                        </div>
                      </td>
                      <td className="py-5 text-center font-black">
                        R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-5 text-center">
                        <Badge 
                          className={cn(
                            "rounded-full px-4 py-1 font-bold text-[10px] uppercase tracking-wider",
                            p.status === 'pago' ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                            p.status === 'isento' ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
                            isVencido ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                            "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                          )}
                        >
                          {p.status === 'pago' ? 'Pago' : p.status === 'isento' ? 'Isento' : isVencido ? 'Vencido' : 'Em aberto'}
                        </Badge>
                      </td>
                      <td className="py-5 text-right">
                        {p.status === 'pago' ? (
                          <div className="flex items-center justify-end gap-2 text-green-500 font-bold text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Pago</span>
                          </div>
                        ) : p.status === 'isento' ? (
                          <span className="text-[#B3B3B3] text-sm">Isento</span>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    disabled 
                                    className="h-8 border-[#2D6ADF]/30 text-[#2D6ADF] opacity-50 cursor-not-allowed text-xs font-bold"
                                  >
                                    Ver boleto
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-white text-black border-none font-bold">
                                <p>Em breve</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </td>
                    </TableRow>
                  );
                })}
                {(!parcelas || parcelas.length === 0) && (
                  <TableRow>
                    <td colSpan={5} className="py-20 text-center text-[#B3B3B3]">
                      <div className="flex flex-col items-center gap-4">
                        <AlertCircle className="h-12 w-12 opacity-20" />
                        <p className="font-bold text-xl">Nenhuma cobrança encontrada</p>
                        <p className="text-sm max-w-xs mx-auto">Suas informações financeiras aparecerão aqui assim que as mensalidades forem geradas.</p>
                      </div>
                    </td>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="bg-[#1E3A5F]/5 p-8 rounded-2xl border border-[#1E3A5F]/20 flex items-start gap-4 shadow-xl">
        <Info className="h-6 w-6 text-[#2D6ADF] shrink-0 mt-1" />
        <div className="space-y-1">
          <p className="font-bold text-white">Dúvidas sobre pagamentos?</p>
          <p className="text-sm text-[#B3B3B3] leading-relaxed">
            Se você tiver qualquer dúvida sobre suas cobranças ou precisar de uma segunda via, entre em contato com nosso setor financeiro pelo suporte.
          </p>
        </div>
      </div>
    </div>
  );
}
