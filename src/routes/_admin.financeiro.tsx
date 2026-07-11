import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { TrendingUp, Landmark, AlertCircle, Wallet, Filter, FileDown, CheckCircle, UserX, BarChart3 } from "lucide-react";
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
import { useVendedoras } from "@/hooks/use-vendedoras";
import { notifyPagamentoRecebido } from "@/lib/notify";

export const Route = createFileRoute("/_admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Soluções Online" }] }),
  component: Financeiro,
});

type FilterType = "recebimentos" | "a_receber" | "atraso" | "vendedora" | "vendas" | "comissoes" | null;


function Financeiro() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const today = new Date();

  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => sessionStorage.getItem("selected_polo_id") || "all");
  const { data: vendedorasList } = useVendedoras(selectedPoloId, { includeInactive: true });

  // States for filters
  const [recPeriod, setRecPeriod] = useState({ 
    start: format(startOfMonth(today), "yyyy-MM-dd"), 
    end: format(endOfMonth(today), "yyyy-MM-dd") 
  });
  const [aRecPeriod, setARecPeriod] = useState({ 
    start: format(startOfMonth(today), "yyyy-MM-dd"), 
    end: format(endOfMonth(today), "yyyy-MM-dd") 
  });


  const [atrasoPeriod, setAtrasoPeriod] = useState({
    start: format(startOfMonth(today), "yyyy-MM-dd"),
    end: format(today, "yyyy-MM-dd")
  });
  const [vendedoraPeriod, setVendedoraPeriod] = useState({ 
    start: format(startOfMonth(today), "yyyy-MM-dd"), 
    end: format(endOfMonth(today), "yyyy-MM-dd") 
  });
  const [selectedVendedora, setSelectedVendedora] = useState<string>("todas");
  const [selectedVendedoraRec, setSelectedVendedoraRec] = useState<string>("todas");

  // Lowering status modal state
  const [baixaModal, setBaixaModal] = useState<{ 
    id: string; 
    open: boolean; 
    date: string;
    isCard?: boolean;
    valor?: number;
    valorPagoAtual?: number;
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
      const [vRecebido, vAReceber, vAtraso, totalAberto] = await Promise.all([
        supabase.from("view_total_recebido_mes").select("total").maybeSingle(),
        supabase.from("view_a_receber_mes").select("total").maybeSingle(),
        supabase.from("view_em_atraso").select("total").maybeSingle(),
        filterByPolo(supabase.from("parcelas").select("valor").neq("status", "isento")),
      ]);

      const sum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => acc + Number(curr.valor), 0);

      return {
        recebido: Number((vRecebido.data as any)?.total ?? 0),
        aReceberMes: Number((vAReceber.data as any)?.total ?? 0),
        atrasado: Number((vAtraso.data as any)?.total ?? 0),
        totalGeral: sum(totalAberto.data),
      };
    },
  });


  const { data: vendedorasAlunos } = useQuery({
    queryKey: ["vendedoras-alunos-distinct", selectedPoloId, userRole, colabData],
    queryFn: async () => {
      const q = supabase.from("alunos").select("vendedora").not("vendedora", "is", null).neq("vendedora", "");
      const { data, error } = await filterByPolo(q);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.vendedora && set.add(r.vendedora));
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });

  const { data: recebimentos, refetch: refetchRecebimentos } = useQuery({
    queryKey: ["financeiro-recebimentos", recPeriod, selectedVendedoraRec],
    queryFn: async () => {
      let q = (supabase as any)
        .from("view_recebimentos_periodo")
        .select("*")
        .gte("data_pagamento", recPeriod.start)
        .lte("data_pagamento", recPeriod.end)
        .order("data_pagamento", { ascending: false });

      if (selectedVendedoraRec !== "todas") {
        q = q.eq("vendedora", selectedVendedoraRec);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: activeFilter === "recebimentos"
  });





  const { data: aReceber, refetch: refetchAReceber } = useQuery({
    queryKey: ["financeiro-a-receber", aRecPeriod, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      let q = supabase
        .from("parcelas")
        .select("*, matriculas!inner(alunos!inner(id, nome, ctr, telefone, ativo), matricula_pacotes(pacotes(tipo)))")
        .in("status", ["aberto", "parcial"])
        .eq("matriculas.alunos.ativo", true)
        .gte("data_vencimento", aRecPeriod.start)
        .lte("data_vencimento", aRecPeriod.end)
        .order("data_vencimento", { ascending: true });
      
      const { data, error } = await filterByPolo(q);
      if (error) throw error;
      return data;
    },
    enabled: activeFilter === "a_receber"
  });




  const { data: atraso, refetch: refetchAtraso } = useQuery({
    queryKey: ["financeiro-atraso", atrasoPeriod, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      let q = supabase
        .from("parcelas")
        .select("*, matriculas!inner(alunos!inner(nome, ctr, telefone, ativo), matricula_pacotes(pacotes(tipo)))")
        .in("status", ["aberto", "parcial"])
        .eq("matriculas.alunos.ativo", true)
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
            ctr,
            telefone,
            vendedora
          ),
          matricula_cursos (
            cursos ( nome )
          ),
          matricula_pacotes (
            pacotes ( nome )
          ),
          parcelas ( valor, tipo, numero, forma_pagamento, status )
        `)
        .eq("alunos.ativo", true)
        .gte("created_at", `${vendedoraPeriod.start}T00:00:00`)
        .lte("created_at", `${vendedoraPeriod.end}T23:59:59`);

      if (selectedVendedora !== "todas") {
        query = query.eq("alunos.vendedora", selectedVendedora);
      }

      query = filterByPolo(query);

      const { data, error } = await query;
      if (error) throw error;

      // Agrupa por matricula_id — uma linha por matrícula
      const byMatricula = new Map<string, any>();
      for (const m of (data ?? [])) {
        if (byMatricula.has(m.id)) continue;
        const aluno = m.alunos as any;

        // Valor total = SOMA das parcelas (independente de forma_pagamento)
        const parcelas = (m.parcelas as any[]) ?? [];
        const valorTotal = parcelas
          .filter((p: any) => (!p.tipo || p.tipo === 'parcela') && p.status !== 'cancelado')
          .reduce((acc: number, p: any) => acc + Number(p.valor || 0), 0);

        const cursosNomes = Array.from(new Set(
          ((m.matricula_cursos as any[]) ?? [])
            .map(mc => mc.cursos?.nome)
            .filter(Boolean)
        ));
        const pacoteNomes = Array.from(new Set(
          ((m.matricula_pacotes as any[]) ?? [])
            .map((mp: any) => mp.pacotes?.nome)
            .filter(Boolean)
        ));
        const cursos = (cursosNomes.length ? cursosNomes : pacoteNomes).join(", ");

        const primeiraParcela = parcelas.find((p: any) => (p.tipo === 'parcela' || !p.tipo) && Number(p.numero) === 1);
        const formaPagamento = primeiraParcela?.forma_pagamento ?? null;

        byMatricula.set(m.id, {
          id: m.id,
          alunoNome: aluno?.nome,
          alunoCtr: aluno?.ctr,
          alunoTelefone: aluno?.telefone,
          vendedora: aluno?.vendedora || "Não informada",
          dataMatricula: m.created_at,
          cursos,
          valorTotal,
          formaPagamento,
        });
      }
      return Array.from(byMatricula.values());
    },
    enabled: activeFilter === "vendedora"
  });

  const darBaixaMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { data: res, error } = await supabase.rpc("registrar_pagamento_parcela", {
        p_parcela_id: id,
        p_valor_pago: data.valor_pago,
        p_data_pagamento: data.data_pagamento,
        p_forma_pagamento: data.forma_pagamento,
        p_parcelas_cartao: data.parcelas_cartao ?? null,
        p_taxa_cartao: data.taxa_cartao ?? null,
        p_valor_liquido: data.valor_liquido ?? null,
        p_observacao: undefined,
      });
      if (error) throw error;
      const resObj = res as { status: string; restante: number } | null;
      if (resObj?.status === "pago") {
        notifyPagamentoRecebido(id, baixaModal?.valor || 0, data.forma_pagamento);
      }
      return { ...data, _result: resObj };
    },
    onSuccess: (data: any) => {
      const isParcial = data._result?.status === "parcial";
      if (isParcial) {
        toast.success(`Pagamento parcial registrado. Restante: R$ ${Number(data._result.restante).toFixed(2)}`);
      } else if (data.forma_pagamento === 'cartao') {
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
      valor: Number(p.valor),
      valorPagoAtual: Number(p.valor_pago_total || 0),
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
    if (p.status === "parcial") return <Badge className="bg-yellow-400 text-yellow-950">🟡 Parcial</Badge>;
    const isVencido = isBefore(parseISO(p.data_vencimento), startOfDay(today));
    if (isVencido) return <Badge variant="destructive">Vencido</Badge>;
    return <Badge className="bg-yellow-500">Aberto</Badge>;
  };

  const getValorEmAtraso = (p: any) => p.status === "parcial"
    ? Number(p.valor) - Number(p.valor_pago_total || 0)
    : Number(p.valor);

  const filterButtons = [
    { id: "recebimentos", label: "Recebimentos", sub: "por período", icon: TrendingUp },
    { id: "a_receber", label: "A Receber", sub: "por período", icon: Landmark },
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
                <Select value={selectedVendedoraRec} onValueChange={setSelectedVendedoraRec}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Vendedora" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {(vendedorasAlunos ?? []).map((nome) => (
                      <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" className="w-40" value={recPeriod.start} onChange={(e) => setRecPeriod(p => ({ ...p, start: e.target.value }))} />
                <span className="text-muted-foreground">até</span>
                <Input type="date" className="w-40" value={recPeriod.end} onChange={(e) => setRecPeriod(p => ({ ...p, end: e.target.value }))} />
                <Button size="sm" onClick={() => refetchRecebimentos()}><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
              </div>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Vendedora</TableHead><TableHead>Forma Pag.</TableHead><TableHead>Data Pagamento</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(recebimentos ?? []).map((p: any, idx: number) => (
                  <TableRow
                    key={`${p.aluno_id}-${p.data_pagamento}-${idx}`}
                    className={p.aluno_id ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => p.aluno_id && navigate({ to: "/alunos/$id", params: { id: p.aluno_id } })}
                  >
                    <TableCell className="font-medium">{p.aluno_nome}</TableCell>
                    <TableCell>{p.ctr}</TableCell>
                    <TableCell>{p.vendedora ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
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
                           'Cartão'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(p.data_pagamento)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold">{formatCurrency(p.valor)}</span>
                        {p.tipo_pagamento === 'parcial' && (
                          <Badge className="bg-yellow-400 text-yellow-950 text-[10px]">🟡 Parcial</Badge>
                        )}
                      </div>
                    </TableCell>
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
                <TableHead>Aluno</TableHead><TableHead>CTR</TableHead><TableHead>Descrição</TableHead><TableHead>Forma Pag.</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(aReceber ?? []).map((p: any) => {
                  const alunoId = p.matriculas?.alunos?.id;
                  return (
                  <TableRow
                    key={p.id}
                    className={alunoId ? "cursor-pointer hover:bg-muted/50" : undefined}
                    onClick={() => alunoId && navigate({ to: "/alunos/$id", params: { id: alunoId }, search: { tab: "financeiro" } })}
                  >
                    <TableCell className="font-medium">{p.matriculas?.alunos?.nome}</TableCell>
                    <TableCell>{p.matriculas?.alunos?.ctr}</TableCell>
                    <TableCell className="capitalize">{p.tipo.replace("_", " ")}</TableCell>
                    <TableCell>
                      {p.forma_pagamento === 'pix' ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none rounded-full text-xs font-bold">PIX</Badge>
                      ) : p.forma_pagamento === 'boleto' ? (
                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none rounded-full text-xs font-bold">Boleto</Badge>
                      ) : p.forma_pagamento === 'cartao' ? (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none rounded-full text-xs font-bold">Cartão</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.valor)}
                      {p.status === "parcial" && (
                        <div className="text-[10px] text-muted-foreground">
                          Pago: {formatCurrency(p.valor_pago_total)} · Restante: {formatCurrency(Number(p.valor) - Number(p.valor_pago_total || 0))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(p)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => openBaixaModal(p)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Dar baixa
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {aReceber?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nada a receber no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="font-bold">Total a receber: {formatCurrency((aReceber ?? []).reduce((acc: number, p: any) => acc + (p.status === "parcial" ? Number(p.valor) - Number(p.valor_pago_total || 0) : Number(p.valor)), 0))}</p>
              <Button variant="outline" size="sm" onClick={() => exportCSV(aReceber || [], "a-receber")}>
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
                    <TableCell className="text-right">{formatCurrency(getValorEmAtraso(p))}</TableCell>
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
                <p className="font-bold">Total em atraso: {formatCurrency((atraso ?? []).reduce((acc: number, p: any) => acc + getValorEmAtraso(p), 0))}</p>
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
                    {(vendedorasList ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.nome}>
                        {v.nome}{v.ativo === false ? " (inativa)" : ""}
                      </SelectItem>
                    ))}
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
                {(vendedorasList ?? [])
                  .map(({ nome: v }) => ({ v, filtered: matriculasVendedora.filter(m => m.vendedora === v) }))
                  .filter(({ filtered }) => filtered.length > 0)
                  .map(({ v, filtered }) => {
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
                <TableHead>Data</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Forma Pgto</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Vendedora</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(matriculasVendedora ?? []).map((m: any) => {
                  const fp = (m.formaPagamento || '').toLowerCase();
                  const badge = fp === 'pix'
                    ? { cls: 'bg-green-100 text-green-700', label: 'PIX' }
                    : fp === 'boleto'
                    ? { cls: 'bg-yellow-100 text-yellow-700', label: 'Boleto' }
                    : fp === 'cartao' || fp === 'cartão'
                    ? { cls: 'bg-blue-100 text-blue-700', label: 'Cartão' }
                    : null;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.dataMatricula)}</TableCell>
                      <TableCell className="font-medium">{m.alunoNome}</TableCell>
                      <TableCell>{m.alunoCtr ?? '—'}</TableCell>
                      <TableCell>
                        {badge ? (
                          <span className={`px-2 py-1 rounded-full text-xs ${badge.cls}`}>{badge.label}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{m.alunoTelefone ?? '—'}</TableCell>
                      <TableCell>{m.vendedora}</TableCell>
                    </TableRow>
                  );
                })}
                {matriculasVendedora?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma matrícula encontrada para o período/vendedora.</TableCell></TableRow>}
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

      {activeFilter === "comissoes" && <ComissoesReport poloId={selectedPoloId} />}




      <BaixaModal 
        open={baixaModal?.open || false}
        onOpenChange={(o) => !o && setBaixaModal(null)}
        isLoading={darBaixaMutation.isPending}
        valorOriginal={baixaModal?.valor || 0}
        valorPagoAtual={baixaModal?.valorPagoAtual || 0}
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
