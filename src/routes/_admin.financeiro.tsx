import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { startOfMonth, endOfMonth, format, isBefore, parseISO, startOfDay } from "date-fns";
import { TrendingUp, Landmark, AlertCircle, Wallet, Filter, FileDown, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — EduManager" }] }),
  component: Financeiro,
});

function Financeiro() {
  const queryClient = useQueryClient();
  const today = new Date();
  
  // States for filters
  const [recPeriod, setRecPeriod] = useState({ 
    start: format(startOfMonth(today), "yyyy-MM-dd"), 
    end: format(endOfMonth(today), "yyyy-MM-dd") 
  });
  const [aRecPeriod, setARecPeriod] = useState({ 
    start: format(startOfMonth(today), "yyyy-MM-dd"), 
    end: format(endOfMonth(today), "yyyy-MM-dd") 
  });
  const [primeirasMonth, setPrimeirasMonth] = useState(format(today, "yyyy-MM"));
  const [ultimasMonth, setUltimasMonth] = useState(format(today, "yyyy-MM"));

  // Lowering status modal state
  const [baixaModal, setBaixaModal] = useState<{ id: string; open: boolean; date: string } | null>(null);

  const { data: globalStats } = useQuery({
    queryKey: ["financeiro-global-stats"],
    queryFn: async () => {
      const firstDay = startOfMonth(today);
      const lastDay = endOfMonth(today);

      const [pagoMes, abertoMes, atrasado, totalAberto] = await Promise.all([
        supabase.from("parcelas").select("valor").eq("status", "pago").gte("data_pagamento", format(firstDay, "yyyy-MM-dd")).lte("data_pagamento", format(lastDay, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").eq("status", "aberto").gte("data_vencimento", format(firstDay, "yyyy-MM-dd")).lte("data_vencimento", format(lastDay, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").eq("status", "aberto").lt("data_vencimento", format(today, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").eq("status", "aberto"),
      ]);

      const sum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => acc + Number(curr.valor), 0);

      return {
        recebido: sum(pagoMes.data),
        aReceberMes: sum(abertoMes.data),
        atrasado: sum(atrasado.data),
        totalGeral: sum(totalAberto.data),
      };
    },
  });

  // Queries for the 4 filters
  const { data: recebimentos, refetch: refetchRecebimentos } = useQuery({
    queryKey: ["financeiro-recebimentos", recPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome), ctr)")
        .eq("status", "pago")
        .gte("data_pagamento", recPeriod.start)
        .lte("data_pagamento", recPeriod.end)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: aReceber, refetch: refetchAReceber } = useQuery({
    queryKey: ["financeiro-a-receber", aRecPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome), ctr)")
        .eq("status", "aberto")
        .gte("data_vencimento", aRecPeriod.start)
        .lte("data_vencimento", aRecPeriod.end)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: primeiras, refetch: refetchPrimeiras } = useQuery({
    queryKey: ["financeiro-primeiras", primeirasMonth],
    queryFn: async () => {
      const [year, month] = primeirasMonth.split("-");
      const start = format(new Date(Number(year), Number(month) - 1, 1), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(Number(year), Number(month) - 1, 1)), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome), ctr)")
        .eq("numero", 1)
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: ultimas, refetch: refetchUltimas } = useQuery({
    queryKey: ["financeiro-ultimas", ultimasMonth],
    queryFn: async () => {
      const [year, month] = ultimasMonth.split("-");
      const start = format(new Date(Number(year), Number(month) - 1, 1), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(Number(year), Number(month) - 1, 1)), "yyyy-MM-dd");

      // To find the last parcel, we need to compare with total parcels in the matricula.
      // Since SQL grouping/max can be complex here, we'll fetch parcelas in range and filter if they are the max number for their matricula.
      // Actually, a simpler way for this feature is to fetch all max parcel numbers.
      const { data: allParcelas, error: pError } = await supabase
        .from("parcelas")
        .select("matricula_id, numero")
        .order("numero", { ascending: false });
      
      if (pError) throw pError;
      
      const maxNums: Record<string, number> = {};
      allParcelas.forEach(p => {
        if (!maxNums[p.matricula_id] || p.numero > maxNums[p.matricula_id]) {
          maxNums[p.matricula_id] = p.numero;
        }
      });

      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome), ctr)")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true });
      
      if (error) throw error;

      return data.filter(p => p.numero === maxNums[p.matricula_id]);
    },
  });

  const darBaixaMutation = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase
        .from("parcelas")
        .update({ status: "pago", data_pagamento: date })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setBaixaModal(null);
      queryClient.invalidateQueries({ queryKey: ["financeiro-global-stats"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-recebimentos"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-a-receber"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-primeiras"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-ultimas"] });
    },
    onError: (e) => {
      toast.error("Erro ao registrar pagamento: " + e.message);
    }
  });

  const exportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = ["Aluno", "CTR", "Descricao", "Data", "Valor", "Status"];
    const csvContent = [
      headers.join(","),
      ...data.map(p => [
        `"${p.matriculas?.alunos?.nome || ""}"`,
        `"${p.matriculas?.ctr || ""}"`,
        `"${p.tipo || ""}"`,
        p.data_pagamento || p.data_vencimento,
        p.valor,
        p.status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cards = [
    { label: "Total Recebido no Mês", value: formatCurrency(globalStats?.recebido), icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "A Receber no Mês", value: formatCurrency(globalStats?.aReceberMes), icon: Landmark, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Em Atraso", value: formatCurrency(globalStats?.atrasado), icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Total Geral a Receber", value: formatCurrency(globalStats?.totalGeral), icon: Wallet, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ];

  const getStatusBadge = (p: any) => {
    if (p.status === "pago") return <Badge className="bg-green-500">Pago</Badge>;
    const isVencido = isBefore(parseISO(p.data_vencimento), startOfDay(today));
    if (isVencido) return <Badge variant="destructive">Vencido</Badge>;
    return <Badge className="bg-yellow-500">Aberto</Badge>;
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Financeiro" description="Controle de recebimentos e cobranças" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="text-2xl font-bold mt-1">{c.value}</p>
                  </div>
                  <div className={`p-2 rounded-full ${c.bg}`}>
                    <Icon className={`h-6 w-6 ${c.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FILTRO 1: Recebimentos */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Recebimentos
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Input 
                type="date" 
                className="w-40" 
                value={recPeriod.start} 
                onChange={(e) => setRecPeriod(prev => ({ ...prev, start: e.target.value }))} 
              />
              <span className="text-muted-foreground">até</span>
              <Input 
                type="date" 
                className="w-40" 
                value={recPeriod.end} 
                onChange={(e) => setRecPeriod(prev => ({ ...prev, end: e.target.value }))} 
              />
              <Button size="sm" onClick={() => refetchRecebimentos()}>
                <Filter className="h-4 w-4 mr-2" /> Filtrar
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(recebimentos || [], "recebimentos")}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data Pagamento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recebimentos ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                  <TableCell>{p.matriculas?.ctr}</TableCell>
                  <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                  <TableCell>{formatDate(p.data_pagamento)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                </TableRow>
              ))}
              {recebimentos?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum recebimento no período.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 pt-4 border-t text-right font-bold">
            Total recebido no período: {formatCurrency((recebimentos ?? []).reduce((acc, p) => acc + Number(p.valor), 0))}
          </div>
        </CardContent>
      </Card>

      {/* FILTRO 2: A Receber */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-blue-500" />
              A Receber
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Input 
                type="date" 
                className="w-40" 
                value={aRecPeriod.start} 
                onChange={(e) => setARecPeriod(prev => ({ ...prev, start: e.target.value }))} 
              />
              <span className="text-muted-foreground">até</span>
              <Input 
                type="date" 
                className="w-40" 
                value={aRecPeriod.end} 
                onChange={(e) => setARecPeriod(prev => ({ ...prev, end: e.target.value }))} 
              />
              <Button size="sm" onClick={() => refetchAReceber()}>
                <Filter className="h-4 w-4 mr-2" /> Filtrar
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(aReceber || [], "a-receber")}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(aReceber ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                  <TableCell>{p.matriculas?.ctr}</TableCell>
                  <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                  <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                  <TableCell>{getStatusBadge(p)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => setBaixaModal({ id: p.id, open: true, date: format(today, "yyyy-MM-dd") })}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Dar baixa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {aReceber?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nada a receber no período.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 pt-4 border-t text-right font-bold">
            Total a receber no período: {formatCurrency((aReceber ?? []).reduce((acc, p) => acc + Number(p.valor), 0))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FILTRO 3: Primeiras Parcelas */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Primeiras Parcelas</h3>
              <div className="flex items-center gap-2">
                <Input 
                  type="month" 
                  className="w-40" 
                  value={primeirasMonth} 
                  onChange={(e) => setPrimeirasMonth(e.target.value)} 
                />
                <Button size="sm" variant="outline" onClick={() => exportCSV(primeiras || [], "primeiras-parcelas")}>
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Venc.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(primeiras ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[120px] truncate">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                    <TableCell>{getStatusBadge(p)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-between items-center text-sm font-semibold">
              <span className="text-muted-foreground">{primeiras?.length || 0} primeiras parcelas encontradas</span>
              <span>Total: {formatCurrency((primeiras ?? []).reduce((acc, p) => acc + Number(p.valor), 0))}</span>
            </div>
          </CardContent>
        </Card>

        {/* FILTRO 4: Últimas Parcelas */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Últimas Parcelas</h3>
              <div className="flex items-center gap-2">
                <Input 
                  type="month" 
                  className="w-40" 
                  value={ultimasMonth} 
                  onChange={(e) => setUltimasMonth(e.target.value)} 
                />
                <Button size="sm" variant="outline" onClick={() => exportCSV(ultimas || [], "ultimas-parcelas")}>
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Venc.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ultimas ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[120px] truncate">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                    <TableCell>{getStatusBadge(p)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-between items-center text-sm font-semibold">
              <span className="text-muted-foreground">{ultimas?.length || 0} últimas parcelas encontradas</span>
              <span>Total: {formatCurrency((ultimas ?? []).reduce((acc, p) => acc + Number(p.valor), 0))}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Baixa */}
      <Dialog open={!!baixaModal?.open} onOpenChange={(open) => !open && setBaixaModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Informe a data em que o pagamento foi realizado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              type="date" 
              value={baixaModal?.date || ""} 
              onChange={(e) => setBaixaModal(prev => prev ? { ...prev, date: e.target.value } : null)} 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaModal(null)}>Cancelar</Button>
            <Button 
              onClick={() => baixaModal && darBaixaMutation.mutate({ id: baixaModal.id, date: baixaModal.date })}
              disabled={darBaixaMutation.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}