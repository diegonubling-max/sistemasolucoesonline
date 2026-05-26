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
import { startOfMonth, endOfMonth, format, isBefore, parseISO, startOfDay, differenceInDays } from "date-fns";
import { TrendingUp, Landmark, AlertCircle, Wallet, Filter, FileDown, CheckCircle, Calendar, Hash, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — EduManager" }] }),
  component: Financeiro,
});

type FilterType = "recebimentos" | "a_receber" | "primeiras" | "ultimas" | "atraso" | null;

function Financeiro() {
  const queryClient = useQueryClient();
  const today = new Date();
  
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);

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
  const [atrasoPeriod, setAtrasoPeriod] = useState({
    start: format(startOfMonth(today), "yyyy-MM-dd"),
    end: format(today, "yyyy-MM-dd")
  });

  // Lowering status modal state
  const [baixaModal, setBaixaModal] = useState<{ 
    id: string; 
    open: boolean; 
    date: string;
    isCard?: boolean;
    valor?: number;
    parcelas?: number;
  } | null>(null);

  const { data: globalStats } = useQuery({
    queryKey: ["financeiro-global-stats"],
    queryFn: async () => {
      const firstDay = startOfMonth(today);
      const lastDay = endOfMonth(today);

      const [pagoMes, abertoMes, atrasado, totalAberto] = await Promise.all([
        supabase.from("parcelas").select("valor").eq("status", "pago").gte("data_pagamento", format(firstDay, "yyyy-MM-dd")).lte("data_pagamento", format(lastDay, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").eq("status", "aberto").gte("data_vencimento", format(firstDay, "yyyy-MM-dd")).lte("data_vencimento", format(lastDay, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").eq("status", "aberto").lt("data_vencimento", format(today, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").neq("status", "isento"),
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

  const { data: recebimentos, refetch: refetchRecebimentos } = useQuery({
    queryKey: ["financeiro-recebimentos", recPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("status", "pago")
        .gte("data_pagamento", recPeriod.start)
        .lte("data_pagamento", recPeriod.end)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: activeFilter === "recebimentos"
  });

  const { data: aReceber, refetch: refetchAReceber } = useQuery({
    queryKey: ["financeiro-a-receber", aRecPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("status", "aberto")
        .gte("data_vencimento", aRecPeriod.start)
        .lte("data_vencimento", aRecPeriod.end)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: activeFilter === "a_receber"
  });

  const { data: primeiras, refetch: refetchPrimeiras } = useQuery({
    queryKey: ["financeiro-primeiras", primeirasMonth],
    queryFn: async () => {
      const [year, month] = primeirasMonth.split("-");
      const start = format(new Date(Number(year), Number(month) - 1, 1), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(Number(year), Number(month) - 1, 1)), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("numero", 1)
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: activeFilter === "primeiras"
  });

  const { data: ultimas, refetch: refetchUltimas } = useQuery({
    queryKey: ["financeiro-ultimas", ultimasMonth],
    queryFn: async () => {
      const [year, month] = ultimasMonth.split("-");
      const start = format(new Date(Number(year), Number(month) - 1, 1), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(Number(year), Number(month) - 1, 1)), "yyyy-MM-dd");

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
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true });
      
      if (error) throw error;

      return data.filter(p => p.numero === maxNums[p.matricula_id]);
    },
    enabled: activeFilter === "ultimas"
  });

  const { data: atraso, refetch: refetchAtraso } = useQuery({
    queryKey: ["financeiro-atraso", atrasoPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("status", "aberto")
        .lt("data_vencimento", format(today, "yyyy-MM-dd"))
        .gte("data_vencimento", atrasoPeriod.start)
        .lte("data_vencimento", atrasoPeriod.end)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;

      return data.map(p => ({
        ...p,
        diasAtraso: differenceInDays(startOfDay(today), startOfDay(parseISO(p.data_vencimento)))
      })).sort((a, b) => b.diasAtraso - a.diasAtraso);
    },
    enabled: activeFilter === "atraso"
  });

  const darBaixaMutation = useMutation({
    mutationFn: async ({ id, date, ...extra }: { id: string; date: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("parcelas")
        .update({ 
          status: "pago", 
          data_pagamento: date,
          ...extra
        })
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
      queryClient.invalidateQueries({ queryKey: ["financeiro-atraso"] });
    },
    onError: (e) => {
      toast.error("Erro ao registrar pagamento: " + e.message);
    }
  });

  const openBaixaModal = (p: any) => {
    const matricula = p.matriculas;
    const pacoteTipo = matricula?.matricula_pacotes?.[0]?.pacotes?.tipo;
    
    if (pacoteTipo === 'cartao' && p.tipo === 'parcela') {
      setBaixaModal({
        id: p.id,
        open: true,
        date: format(today, "yyyy-MM-dd"),
        isCard: true,
        valor: Number(p.valor),
        parcelas: 1
      });
    } else {
      setBaixaModal({
        id: p.id,
        open: true,
        date: format(today, "yyyy-MM-dd"),
        isCard: false
      });
    }
  };

  const exportCSV = (data: any[], filename: string, extraHeaders: string[] = [], extraFields: (p: any) => string[] = () => []) => {
    if (!data || data.length === 0) return;
    const baseHeaders = ["Aluno", "CTR", "Descricao", "Data", "Valor", "Status"];
    const headers = [...baseHeaders, ...extraHeaders];
    
    const csvContent = [
      headers.join(","),
      ...data.map(p => {
        const base = [
          `"${p.matriculas?.alunos?.nome || ""}"`,
          `"${p.matriculas?.alunos?.ctr || ""}"`,
          `"${p.tipo || ""}"`,
          p.data_pagamento || p.data_vencimento,
          p.valor,
          p.status
        ];
        return [...base, ...extraFields(p)].join(",");
      })
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

  const summaryCards = [
    { label: "Total Recebido no Mês", value: formatCurrency(globalStats?.recebido), icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "A Receber no Mês", value: formatCurrency(globalStats?.aReceberMes), icon: Landmark, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Em Atraso", value: formatCurrency(globalStats?.atrasado), icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
  ];

  const getStatusBadge = (p: any) => {
    if (p.status === "pago") return <Badge className="bg-green-500">Pago</Badge>;
    const isVencido = isBefore(parseISO(p.data_vencimento), startOfDay(today));
    if (isVencido) return <Badge variant="destructive">Vencido</Badge>;
    return <Badge className="bg-yellow-500">Aberto</Badge>;
  };

  const filterButtons = [
    { id: "recebimentos", label: "Recebimentos", sub: "por período", icon: TrendingUp },
    { id: "a_receber", label: "A Receber", sub: "por período", icon: Landmark },
    { id: "primeiras", label: "Primeiras", sub: "Parcelas", icon: Hash },
    { id: "ultimas", label: "Últimas", sub: "Parcelas", icon: Calendar },
    { id: "atraso", label: "Alunos em", sub: "Atraso", icon: UserX },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Financeiro" description="Controle de recebimentos e cobranças" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => {
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {filterButtons.map((btn) => {
          const Icon = btn.icon;
          const isSelected = activeFilter === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => setActiveFilter(isSelected ? null : btn.id as FilterType)}
              className={cn(
                "flex flex-col items-center justify-center p-4 rounded-xl border transition-all text-center",
                isSelected 
                  ? "bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-lg" 
                  : "bg-white text-[#1E3A5F] border-gray-200 hover:border-[#1E3A5F]/50"
              )}
            >
              <Icon className={cn("h-6 w-6 mb-2", isSelected ? "text-white" : "text-[#1E3A5F]")} />
              <p className="font-bold text-sm leading-tight">{btn.label}</p>
              <p className={cn("text-xs", isSelected ? "text-white/80" : "text-muted-foreground")}>{btn.sub}</p>
            </button>
          );
        })}
      </div>

      {activeFilter === "recebimentos" && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Recebimentos por Período
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" className="w-40" value={recPeriod.start} onChange={(e) => setRecPeriod(p => ({ ...p, start: e.target.value }))} />
                <span className="text-muted-foreground">até</span>
                <Input type="date" className="w-40" value={recPeriod.end} onChange={(e) => setRecPeriod(p => ({ ...p, end: e.target.value }))} />
                <Button size="sm" onClick={() => refetchRecebimentos()}><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
              </div>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Descrição</TableHead><TableHead>Data Pagamento</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(recebimentos ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{p.matriculas?.alunos?.ctr}</TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                    <TableCell>{formatDate(p.data_pagamento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                  </TableRow>
                ))}
                {recebimentos?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum recebimento no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="font-bold">Total recebido: {formatCurrency((recebimentos ?? []).reduce((acc: number, p: any) => acc + Number(p.valor), 0))}</p>
              <Button variant="outline" size="sm" onClick={() => exportCSV(recebimentos || [], "recebimentos")}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeFilter === "a_receber" && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-blue-500" />
                A Receber por Período
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" className="w-40" value={aRecPeriod.start} onChange={(e) => setARecPeriod(p => ({ ...p, start: e.target.value }))} />
                <span className="text-muted-foreground">até</span>
                <Input type="date" className="w-40" value={aRecPeriod.end} onChange={(e) => setARecPeriod(p => ({ ...p, end: e.target.value }))} />
                <Button size="sm" onClick={() => refetchAReceber()}><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
              </div>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(aReceber ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{p.matriculas?.alunos?.ctr}</TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                    <TableCell>{getStatusBadge(p)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => openBaixaModal(p)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Dar baixa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {aReceber?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nada a receber no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="font-bold">Total a receber: {formatCurrency((aReceber ?? []).reduce((acc: number, p: any) => acc + Number(p.valor), 0))}</p>
              <Button variant="outline" size="sm" onClick={() => exportCSV(aReceber || [], "a-receber")}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeFilter === "primeiras" && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Hash className="h-5 w-5 text-orange-500" />
                Primeiras Parcelas
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="month" className="w-40" value={primeirasMonth} onChange={(e) => setPrimeirasMonth(e.target.value)} />
                <Button size="sm" onClick={() => refetchPrimeiras()}><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{primeiras?.length || 0} primeiras parcelas encontradas</p>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(primeiras ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{p.matriculas?.alunos?.ctr}</TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                    <TableCell>{getStatusBadge(p)}</TableCell>
                    <TableCell className="text-right">
                      {p.status === 'aberto' && (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => openBaixaModal(p)}>
                          <CheckCircle className="h-4 w-4 mr-2" /> Dar baixa
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="font-bold">Total: {formatCurrency((primeiras ?? []).reduce((acc: number, p: any) => acc + Number(p.valor), 0))}</p>
              <Button variant="outline" size="sm" onClick={() => exportCSV(primeiras || [], "primeiras-parcelas")}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeFilter === "ultimas" && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-500" />
                Últimas Parcelas
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="month" className="w-40" value={ultimasMonth} onChange={(e) => setUltimasMonth(e.target.value)} />
                <Button size="sm" onClick={() => refetchUltimas()}><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{ultimas?.length || 0} últimas parcelas encontradas</p>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(ultimas ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{p.matriculas?.alunos?.ctr}</TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                    <TableCell>{getStatusBadge(p)}</TableCell>
                    <TableCell className="text-right">
                      {p.status === 'aberto' && (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => openBaixaModal(p)}>
                          <CheckCircle className="h-4 w-4 mr-2" /> Dar baixa
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="font-bold">Total: {formatCurrency((ultimas ?? []).reduce((acc: number, p: any) => acc + Number(p.valor), 0))}</p>
              <Button variant="outline" size="sm" onClick={() => exportCSV(ultimas || [], "ultimas-parcelas")}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeFilter === "atraso" && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-500" />
                Alunos em Atraso
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" className="w-40" value={atrasoPeriod.start} onChange={(e) => setAtrasoPeriod(p => ({ ...p, start: e.target.value }))} />
                <span className="text-muted-foreground">até</span>
                <Input type="date" className="w-40" value={atrasoPeriod.end} onChange={(e) => setAtrasoPeriod(p => ({ ...p, end: e.target.value }))} />
                <Button size="sm" onClick={() => refetchAtraso()}><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
              </div>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Telefone</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Dias em Atraso</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(atraso ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{p.matriculas?.alunos?.ctr}</TableCell>
                    <TableCell>{p.matriculas?.alunos?.telefone}</TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                    <TableCell><Badge variant="destructive">{p.diasAtraso} dias</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => openBaixaModal(p)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Dar baixa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {atraso?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum aluno em atraso no período selecionado.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{atraso?.length || 0} alunos em atraso</p>
                <p className="font-bold">Total em atraso: {formatCurrency((atraso ?? []).reduce((acc: number, p: any) => acc + Number(p.valor), 0))}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportCSV(atraso || [], "alunos-em-atraso", ["Dias em Atraso"], (p) => [String(p.diasAtraso)])}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Baixa */}
      <Dialog open={!!baixaModal?.open} onOpenChange={(open) => !open && setBaixaModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{baixaModal?.isCard ? "Pagamento no Cartão" : "Confirmar Pagamento"}</DialogTitle>
            <DialogDescription>
              {baixaModal?.isCard ? "Selecione o parcelamento utilizado pelo aluno." : "Informe a data em que o pagamento foi realizado."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {baixaModal?.isCard && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Parcelas</Label>
                  <Select 
                    value={String(baixaModal.parcelas)} 
                    onValueChange={(v) => setBaixaModal(prev => prev ? { ...prev, parcelas: parseInt(v) } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione as parcelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                        <SelectItem key={num} value={String(num)}>{num}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor bruto:</span>
                    <span className="font-medium">{formatCurrency(baixaModal.valor || 0)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Taxa (8%):</span>
                    <span>- {formatCurrency((baixaModal.valor || 0) * 0.08)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold text-base">
                    <span>Valor líquido:</span>
                    <span className="text-green-600">{formatCurrency((baixaModal.valor || 0) * 0.92)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{baixaModal?.isCard ? "Data do recebimento" : "Data do pagamento"}</Label>
              <Input 
                type="date" 
                value={baixaModal?.date || ""} 
                onChange={(e) => setBaixaModal(prev => prev ? { ...prev, date: e.target.value } : null)} 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaModal(null)}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (!baixaModal) return;
                const extra = baixaModal.isCard ? {
                  valor_bruto: baixaModal.valor,
                  valor_taxa: (baixaModal.valor || 0) * 0.08,
                  valor_liquido: (baixaModal.valor || 0) * 0.92,
                  cartao_parcelas: baixaModal.parcelas,
                  observacao: `Pagamento em ${baixaModal.parcelas}x no cartão`
                } : {};
                
                darBaixaMutation.mutate({ 
                  id: baixaModal.id, 
                  date: baixaModal.date,
                  ...extra
                });
              }} 
              disabled={darBaixaMutation.isPending}
            >
              {baixaModal?.isCard ? "Confirmar baixa" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
