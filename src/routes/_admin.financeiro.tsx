import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { startOfMonth, endOfMonth, format, isBefore, parseISO, startOfDay, differenceInDays } from "date-fns";
import { TrendingUp, Landmark, AlertCircle, Wallet, Filter, FileDown, CheckCircle, Calendar, Hash, UserX, BarChart3 } from "lucide-react";
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
import { BaixaModal } from "@/components/admin/BaixaModal";
import { ResumoBaixaModal } from "@/components/admin/ResumoBaixaModal";
import { SalesReport } from "@/components/admin/financeiro/SalesReport";
import { ComissoesReport } from "@/components/admin/financeiro/ComissoesReport";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — EduManager" }] }),
  component: Financeiro,
});

type FilterType = "recebimentos" | "a_receber" | "primeiras" | "ultimas" | "atraso" | "vendedora" | "vendas" | "comissoes" | null;


function Financeiro() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date();
  
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => sessionStorage.getItem("selected_polo_id") || "all");

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
  const [vendedoraPeriod, setVendedoraPeriod] = useState({ 
    start: format(startOfMonth(today), "yyyy-MM-dd"), 
    end: format(endOfMonth(today), "yyyy-MM-dd") 
  });
  const [selectedVendedora, setSelectedVendedora] = useState<string>("todas");

  // Lowering status modal state
  const [baixaModal, setBaixaModal] = useState<{ 
    id: string; 
    open: boolean; 
    date: string;
    isCard?: boolean;
    valor?: number;
    parcelas?: number;
  } | null>(null);

  const [resumoBaixa, setResumoBaixa] = useState<{
    formaPagamento: string;
    parcelas?: number;
    valorBruto: number;
    taxa?: number;
    valorLiquido: number;
    dataPagamento: string;
  } | null>(null);

  useEffect(() => {
    const handlePoloChange = () => {
      setSelectedPoloId(sessionStorage.getItem("selected_polo_id") || "all");
      console.log("DEBUG [Financeiro]: Polo alterado para:", sessionStorage.getItem("selected_polo_id"));
    };
    window.addEventListener("polo-changed", handlePoloChange);
    return () => window.removeEventListener("polo-changed", handlePoloChange);
  }, []);

  const { data: userRole } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
      return data?.role;
    },
    enabled: !!session?.user?.id
  });

  const { data: colabData } = useQuery({
    queryKey: ["colaborador-polo", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase.from('colaboradores').select('polo_id').eq('user_id', session.user.id).maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id
  });

  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';

  const filterByPolo = (q: any) => {
    const colabPoloId = colabData?.polo_id;
    if (isSuperAdmin) {
      if (selectedPoloId && selectedPoloId !== 'all') {
        return q.eq('polo_id', selectedPoloId);
      }
    } else if (colabPoloId) {
      return q.eq('polo_id', colabPoloId);
    }
    return q;
  };

  const { data: globalStats } = useQuery({
    queryKey: ["financeiro-global-stats", selectedPoloId, userRole, colabData],
    queryFn: async () => {
      const firstDay = startOfMonth(today);
      const lastDay = endOfMonth(today);

      console.log("DEBUG [Financeiro Global Stats]:", { isSuperAdmin, selectedPoloId, colabPoloId: colabData?.polo_id });

      const [pagoMes, abertoMes, atrasado, totalAberto] = await Promise.all([
        filterByPolo(supabase.from("parcelas").select("valor, valor_liquido, forma_pagamento").eq("status", "pago").gte("data_pagamento", format(firstDay, "yyyy-MM-dd")).lte("data_pagamento", format(lastDay, "yyyy-MM-dd"))),
        filterByPolo(supabase.from("parcelas").select("valor").eq("status", "aberto").gte("data_vencimento", format(firstDay, "yyyy-MM-dd")).lte("data_vencimento", format(lastDay, "yyyy-MM-dd"))),
        filterByPolo(supabase.from("parcelas").select("valor").eq("status", "aberto").lt("data_vencimento", format(today, "yyyy-MM-dd"))),
        filterByPolo(supabase.from("parcelas").select("valor").neq("status", "isento")),
      ]);

      const sum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => acc + Number(curr.valor), 0);
      const receivedSum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => {
        const isCartao = curr.forma_pagamento === 'cartao';
        const val = isCartao && curr.valor_liquido ? Number(curr.valor_liquido) : Number(curr.valor);
        return acc + val;
      }, 0);

      return {
        recebido: receivedSum(pagoMes.data),
        aReceberMes: sum(abertoMes.data),
        atrasado: sum(atrasado.data),
        totalGeral: sum(totalAberto.data),
      };
    },
  });

  const { data: recebimentos, refetch: refetchRecebimentos } = useQuery({
    queryKey: ["financeiro-recebimentos", recPeriod, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      let q = supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("status", "pago")
        .gte("data_pagamento", recPeriod.start)
        .lte("data_pagamento", recPeriod.end)
        .order("data_pagamento", { ascending: false });
      
      const { data, error } = await filterByPolo(q);
      if (error) throw error;
      return data;
    },
    enabled: activeFilter === "recebimentos"
  });

  const { data: aReceber, refetch: refetchAReceber } = useQuery({
    queryKey: ["financeiro-a-receber", aRecPeriod, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      let q = supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("status", "aberto")
        .gte("data_vencimento", aRecPeriod.start)
        .lte("data_vencimento", aRecPeriod.end)
        .order("data_vencimento", { ascending: true });
      
      const { data, error } = await filterByPolo(q);
      if (error) throw error;
      return data;
    },
    enabled: activeFilter === "a_receber"
  });

  const { data: primeiras, refetch: refetchPrimeiras } = useQuery({
    queryKey: ["financeiro-primeiras", primeirasMonth, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      const [year, month] = primeirasMonth.split("-");
      const start = format(new Date(Number(year), Number(month) - 1, 1), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(Number(year), Number(month) - 1, 1)), "yyyy-MM-dd");
      
      let q = supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("numero", 1)
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true });
      
      const { data, error } = await filterByPolo(q);
      if (error) throw error;
      return data;
    },
    enabled: activeFilter === "primeiras"
  });

  const { data: ultimas, refetch: refetchUltimas } = useQuery({
    queryKey: ["financeiro-ultimas", ultimasMonth, selectedPoloId, userRole, colabData],
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

      let q = supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true });
      
      const { data, error } = await filterByPolo(q);
      if (error) throw error;

      return data.filter((p: any) => p.numero === maxNums[p.matricula_id]);
    },
    enabled: activeFilter === "ultimas"
  });

  const { data: atraso, refetch: refetchAtraso } = useQuery({
    queryKey: ["financeiro-atraso", atrasoPeriod, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      let q = supabase
        .from("parcelas")
        .select("*, matriculas(alunos(nome, ctr, telefone), matricula_pacotes(pacotes(tipo)))")
        .eq("status", "aberto")
        .lt("data_vencimento", format(today, "yyyy-MM-dd"))
        .gte("data_vencimento", atrasoPeriod.start)
        .lte("data_vencimento", atrasoPeriod.end)
        .order("data_vencimento", { ascending: true });
      
      const { data, error } = await filterByPolo(q);
      if (error) throw error;

      return data.map((p: any) => ({
        ...p,
        diasAtraso: differenceInDays(startOfDay(today), startOfDay(parseISO(p.data_vencimento)))
      })).sort((a: any, b: any) => b.diasAtraso - a.diasAtraso);
    },
    enabled: activeFilter === "atraso"
  });

  const { data: matriculasVendedora, refetch: refetchVendedora } = useQuery({
    queryKey: ["financeiro-vendedora", vendedoraPeriod, selectedVendedora, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      let query = supabase
        .from("matriculas")
        .select(`
          id,
          created_at,
          polo_id,
          alunos!inner (
            nome,
            vendedora
          ),
          matricula_pacotes (
            pacotes (
              nome,
              valor_total
            )
          )
        `)
        .gte("created_at", `${vendedoraPeriod.start}T00:00:00`)
        .lte("created_at", `${vendedoraPeriod.end}T23:59:59`);

      if (selectedVendedora !== "todas") {
        query = query.eq("alunos.vendedora", selectedVendedora);
      }

      query = filterByPolo(query);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map(m => {
        const aluno = m.alunos as any;
        const pacotes = (m.matricula_pacotes as any[]).map(mp => mp.pacotes);
        const valorTotal = pacotes.reduce((acc, p) => acc + Number(p.valor_total), 0);
        const cursos = pacotes.map(p => p.nome).join(", ");
        
        return {
          id: m.id,
          alunoNome: aluno?.nome,
          vendedora: aluno?.vendedora || "Não informada",
          dataMatricula: m.created_at,
          cursos,
          valorTotal
        };
      });
    },
    enabled: activeFilter === "vendedora"
  });

  const darBaixaMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("parcelas")
        .update({ 
          status: "pago", 
          ...data
        })
        .eq("id", id);
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.forma_pagamento === 'cartao') {
        setResumoBaixa({
          formaPagamento: 'cartao',
          parcelas: data.parcelas_cartao,
          valorBruto: baixaModal?.valor || 0,
          taxa: data.taxa_cartao,
          valorLiquido: data.valor_liquido,
          dataPagamento: data.data_pagamento,
        });
      } else {
        toast.success("Pagamento registrado com sucesso!");
      }
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
    setBaixaModal({
      id: p.id,
      open: true,
      date: format(today, "yyyy-MM-dd"),
      valor: Number(p.valor)
    });
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

  const exportVendedoraCSV = () => {
    if (!matriculasVendedora || matriculasVendedora.length === 0) return;
    const headers = ["Aluno", "Data Matrícula", "Cursos", "Valor Total", "Vendedora"];
    
    const csvContent = [
      headers.join(","),
      ...matriculasVendedora.map(m => [
        `"${m.alunoNome}"`,
        formatDate(m.dataMatricula),
        `"${m.cursos}"`,
        m.valorTotal,
        `"${m.vendedora}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `matriculas-por-vendedora.csv`);
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
    { id: "vendedora", label: "Matrículas por", sub: "Vendedora", icon: Wallet },
    { id: "vendas", label: "Relatório de", sub: "Vendas", icon: BarChart3 },
    { id: "comissoes", label: "Comissões", sub: "Vendedoras", icon: Wallet },
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
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Descrição</TableHead><TableHead>Forma Pag.</TableHead><TableHead>Data Pagamento</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(recebimentos ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {p.matriculas?.alunos?.ctr}
                      {p.asaas_id ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 h-4">Asaas</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 h-4">Carnê</Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                    <TableCell>
                      {p.forma_pagamento && (
                        <Badge 
                          className={cn(
                            "font-bold",
                            p.forma_pagamento === 'boleto' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                            p.forma_pagamento === 'pix' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                            "bg-purple-100 text-purple-700 hover:bg-purple-100"
                          )}
                        >
                          {p.forma_pagamento === 'boleto' ? 'Boleto' : 
                           p.forma_pagamento === 'pix' ? 'PIX' : 
                           `Cartão ${p.parcelas_cartao}x`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(p.data_pagamento)}</TableCell>
                    <TableCell className="text-right">
                      {p.forma_pagamento === 'cartao' && p.valor_liquido ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-muted-foreground line-through">{formatCurrency(p.valor)}</span>
                          <span className="text-green-600 font-bold">{formatCurrency(p.valor_liquido)}</span>
                        </div>
                      ) : (
                        formatCurrency(p.valor)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {recebimentos?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum recebimento no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="font-bold">Total recebido: {formatCurrency((recebimentos ?? []).reduce((acc: number, p: any) => acc + Number(p.forma_pagamento === 'cartao' && p.valor_liquido ? p.valor_liquido : p.valor), 0))}</p>
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
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Descrição</TableHead><TableHead>Forma Pag.</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(aReceber ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {p.matriculas?.alunos?.ctr}
                      {p.asaas_id ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 h-4">Asaas</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 h-4">Carnê</Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                    <TableCell>—</TableCell>
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
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(primeiras ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {p.matriculas?.alunos?.ctr}
                      {p.asaas_id ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 h-4">Asaas</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 h-4">Carnê</Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
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
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(ultimas ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {p.matriculas?.alunos?.ctr}
                      {p.asaas_id ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 h-4">Asaas</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 h-4">Carnê</Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
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

      {activeFilter === "vendedora" && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-indigo-500" />
                Matrículas por Vendedora
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedVendedora} onValueChange={setSelectedVendedora}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Vendedora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as vendedoras</SelectItem>
                    <SelectItem value="Gislaine">Gislaine</SelectItem>
                    <SelectItem value="Vera">Vera</SelectItem>
                    <SelectItem value="Gabrielly">Gabrielly</SelectItem>
                    <SelectItem value="Maria Eduarda">Maria Eduarda</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" className="w-40" value={vendedoraPeriod.start} onChange={(e) => setVendedoraPeriod(p => ({ ...p, start: e.target.value }))} />
                <span className="text-muted-foreground">até</span>
                <Input type="date" className="w-40" value={vendedoraPeriod.end} onChange={(e) => setVendedoraPeriod(p => ({ ...p, end: e.target.value }))} />
                <Button size="sm" onClick={() => refetchVendedora()}><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
              </div>
            </div>

            {selectedVendedora === "todas" && matriculasVendedora && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {["Gislaine", "Vera", "Gabrielly", "Maria Eduarda"].map(v => {
                  const filtered = matriculasVendedora.filter(m => m.vendedora === v);
                  const totalVal = filtered.reduce((acc, curr) => acc + curr.valorTotal, 0);
                  return (
                    <Card key={v} className="bg-slate-50 border-none shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-sm font-semibold text-slate-500">{v}</p>
                        <div className="flex items-end justify-between mt-1">
                          <div>
                            <p className="text-2xl font-bold">{filtered.length}</p>
                            <p className="text-xs text-slate-400">matrículas</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-600">{formatCurrency(totalVal)}</p>
                            <p className="text-xs text-slate-400">gerado</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <Table>
              <TableHeader><TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Data Matrícula</TableHead>
                <TableHead>Curso(s)</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(matriculasVendedora ?? []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.alunoNome}</TableCell>
                    <TableCell>{formatDate(m.dataMatricula)}</TableCell>
                    <TableCell>{m.cursos}</TableCell>
                    <TableCell>{m.vendedora}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(m.valorTotal)}</TableCell>
                  </TableRow>
                ))}
                {matriculasVendedora?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma matrícula encontrada para o período/vendedora.</TableCell></TableRow>}
              </TableBody>
            </Table>

            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{matriculasVendedora?.length || 0} matrículas no período</p>
                <p className="font-bold text-lg">Total gerado: {formatCurrency((matriculasVendedora ?? []).reduce((acc: number, m: any) => acc + Number(m.valorTotal), 0))}</p>
              </div>
              <Button variant="outline" size="sm" onClick={exportVendedoraCSV}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeFilter === "vendas" && <SalesReport />}

      {activeFilter === "comissoes" && <ComissoesReport />}




      <BaixaModal 
        open={baixaModal?.open || false}
        onOpenChange={(o) => !o && setBaixaModal(null)}
        isLoading={darBaixaMutation.isPending}
        valorOriginal={baixaModal?.valor || 0}
        onConfirm={(data) => {
          if (baixaModal?.id) {
            darBaixaMutation.mutate({ id: baixaModal.id, ...data });
          }
        }}
      />

      <ResumoBaixaModal 
        open={!!resumoBaixa}
        onOpenChange={(open) => !open && setResumoBaixa(null)}
        data={resumoBaixa}
      />
    </div>
  );
}
