import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import { formatCurrency, formatDate, maskPhone } from "@/lib/format";
import { FileDown, Users, Package, MapPin, TrendingUp, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useVendedoras } from "@/hooks/use-vendedoras";

interface Origin {
  name: string;
  count: number;
  percent: number;
}

export function SalesReport() {
  const { session } = useAuth();
  const today = new Date();
  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => sessionStorage.getItem("selected_polo_id") || "all");
  
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(today), "yyyy-MM-dd"),
    endDate: format(endOfMonth(today), "yyyy-MM-dd"),
    vendedora: "todas",
    pacote: "todos",
    origem: "todas",
    formaPagamento: "todas"
  });

  useEffect(() => {
    const handlePoloChange = () => {
      setSelectedPoloId(sessionStorage.getItem("selected_polo_id") || "all");
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

  const { data: pacotes } = useQuery({
    queryKey: ["pacotes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacotes")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    }
  });

  const { data: vendedorasList } = useVendedoras(selectedPoloId);


  const { data: reportData, isLoading } = useQuery({
    queryKey: ["sales-report-data", filters, selectedPoloId, userRole, colabData],
    queryFn: async () => {
      let query = supabase
        .from("matriculas")
        .select(`
          id,
          created_at,
          observacao,
          polo_id,
          colaborador_id,
          colaboradores ( id, nome ),
          alunos!inner (
            nome,
            vendedora,
            origem,
            ctr,
            telefone,
            ativo
          ),
          matricula_pacotes (
            pacote_id,
            pacotes (
              id,
              nome,
              valor_total
            )
          ),
          parcelas (
            valor,
            status,
            tipo,
            numero,
            tipo_pacote,
            cartao_parcelas,
            forma_pagamento
          )
        `)
        .gte("created_at", `${filters.startDate}T00:00:00`)
        .lte("created_at", `${filters.endDate}T23:59:59`)
        .eq("alunos.ativo", true)
        .order("created_at", { ascending: false });

      if (filters.vendedora !== "todas") {
        query = query.eq("colaborador_id", filters.vendedora);
      }
      
      if (filters.origem !== "todas") {
        query = query.eq("alunos.origem", filters.origem as any);
      }

      query = filterByPolo(query);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data || []).map(m => {
        const aluno = m.alunos as any;
        const colaborador = (m as any).colaboradores as { id: string; nome: string } | null;
        const matriculaPacotes = (m.matricula_pacotes as any[]) || [];
        const isPersonalizado = matriculaPacotes.length > 0 && matriculaPacotes.some(mp => mp.pacote_id === null);
        const parcelas = (m.parcelas as any[] || []);
        
        let pacoteNome = "";
        const valorTotal = parcelas.reduce((acc, p) => acc + Number(p.valor), 0);

        if (isPersonalizado) {
          pacoteNome = "Negociação Personalizada";
        } else if (matriculaPacotes.length > 0) {
          const seen = new Set<string>();
          const pacs = matriculaPacotes
            .map(mp => mp.pacotes)
            .filter(Boolean)
            .filter((p: any) => {
              if (seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            });
          pacoteNome = pacs.map((p: any) => p.nome).join(", ");
        }

        // Enriquecer com info de forma de pagamento da 1ª parcela
        const primeira = parcelas.find(p => p.tipo === 'parcela' && Number(p.numero) === 1);
        let formaPagamentoKey: 'pix' | 'boleto' | 'cartao' | 'outro' = 'outro';
        let formaPagamentoLabel = '—';
        if (primeira) {
          const tipoPac = (primeira.tipo_pacote || '').toString();
          const forma = (primeira.forma_pagamento || '').toString().toLowerCase();
          const cartaoParc = Number(primeira.cartao_parcelas || 0);
          const valorParc = Number(primeira.valor || 0);
          let sufixo = "";
          if (tipoPac === 'cartao_acelerado' && cartaoParc > 0) {
            sufixo = `Cartão Acelerado (Cartão - ${cartaoParc}x de ${formatCurrency(valorParc)})`;
            formaPagamentoKey = 'cartao';
            formaPagamentoLabel = `Cartão ${cartaoParc}x`;
          } else if (forma === 'cartao' && cartaoParc > 0) {
            sufixo = `Cartão (${cartaoParc}x de ${formatCurrency(valorParc)})`;
            formaPagamentoKey = 'cartao';
            formaPagamentoLabel = `Cartão ${cartaoParc}x`;
          } else if (forma === 'cartao') {
            formaPagamentoKey = 'cartao';
            formaPagamentoLabel = 'Cartão';
          } else if (forma === 'pix') {
            sufixo = 'PIX';
            formaPagamentoKey = 'pix';
            formaPagamentoLabel = 'PIX';
          } else if (forma === 'boleto') {
            formaPagamentoKey = 'boleto';
            formaPagamentoLabel = 'Boleto';
          } else if (forma === 'avista') {
            sufixo = 'À Vista';
            formaPagamentoLabel = 'À Vista';
          } else if (tipoPac) {
            sufixo = tipoPac;
          }
          if (sufixo && !pacoteNome) {
            pacoteNome = sufixo;
          }
        }
        if (!pacoteNome) pacoteNome = "—";

        const valorRecebido = parcelas.filter(p => p.status === 'pago').reduce((acc, p) => acc + Number(p.valor), 0);
        const valorEmAberto = parcelas.filter(p => p.status === 'aberto').reduce((acc, p) => acc + Number(p.valor), 0);

        return {
          id: m.id,
          alunoNome: aluno?.nome,
          alunoCtr: aluno?.ctr,
          alunoTelefone: aluno?.telefone || "",
          vendedora: aluno?.vendedora || "Não informada",
          colaboradorId: (m as any).colaborador_id as string | null,
          colaboradorNome: colaborador?.nome ?? null,
          origem: aluno?.origem || "Outros",
          dataMatricula: m.created_at,
          pacoteNome,
          pacoteIds: matriculaPacotes.map(mp => mp.pacote_id),
          formaPagamentoKey,
          formaPagamentoLabel,
          valorTotal,
          valorRecebido,
          valorEmAberto
        };
      });

      if (filters.pacote !== "todos") {
        filtered = filtered.filter(f => f.pacoteIds.includes(filters.pacote));
      }

      if (filters.formaPagamento !== "todas") {
        filtered = filtered.filter(f => f.formaPagamentoKey === filters.formaPagamento);
      }

      return filtered;
    }
  });

  const stats = useMemo(() => {
    if (!reportData) return { totalMatriculas: 0, valorTotal: 0, valorRecebido: 0, valorEmAberto: 0, ticketMedio: 0 };
    const totalMatriculas = reportData.length;
    const valorTotal = reportData.reduce((acc, curr) => acc + curr.valorTotal, 0);
    const valorRecebido = reportData.reduce((acc, curr) => acc + curr.valorRecebido, 0);
    const valorEmAberto = reportData.reduce((acc, curr) => acc + curr.valorEmAberto, 0);
    const ticketMedio = totalMatriculas > 0 ? valorTotal / totalMatriculas : 0;
    return { totalMatriculas, valorTotal, valorRecebido, valorEmAberto, ticketMedio };
  }, [reportData]);

  const vendedorasStats = useMemo(() => {
    if (!reportData) return [];
    const map: Record<string, { nome: string; total: number; valor: number; valorRecebido: number; valorEmAberto: number }> = {};

    reportData.forEach(r => {
      // Agrupar por colaborador_id; ignorar matrículas sem colaborador vinculado
      if (!r.colaboradorId || !r.colaboradorNome) return;
      const key = r.colaboradorId;
      if (!map[key]) map[key] = { nome: r.colaboradorNome, total: 0, valor: 0, valorRecebido: 0, valorEmAberto: 0 };
      map[key].total += 1;
      map[key].valor += r.valorTotal;
      map[key].valorRecebido += r.valorRecebido;
      map[key].valorEmAberto += r.valorEmAberto;
    });

    const maxValor = Math.max(...Object.values(map).map(m => m.valor), 1);

    return Object.entries(map).map(([id, data]) => ({
      id,
      ...data,
      percent: (data.valor / maxValor) * 100
    })).sort((a, b) => b.valor - a.valor);
  }, [reportData]);

  const pacotesStats = useMemo(() => {
    if (!reportData) return [];
    const map: Record<string, { total: number, valor: number }> = {};
    reportData.forEach(r => {
      const p = r.pacoteNome || "Sem Pacote";
      if (!map[p]) map[p] = { total: 0, valor: 0 };
      map[p].total += 1;
      map[p].valor += r.valorTotal;
    });
    return Object.entries(map).map(([nome, data]) => ({
      nome,
      ...data
    })).sort((a, b) => b.total - a.total);
  }, [reportData]);

  const origensStats = useMemo(() => {
    if (!reportData) return [];
    const map: Record<string, { total: number }> = {};
    const total = reportData.length;
    
    // Initialize default sources
    ["Google", "Meta", "Indicação", "Outros"].forEach(o => map[o] = { total: 0 });

    reportData.forEach(r => {
      const o = r.origem;
      const label = o.charAt(0).toUpperCase() + o.slice(1);
      if (!map[label]) map[label] = { total: 0 };
      map[label].total += 1;
    });

    return Object.entries(map).map(([nome, data]) => ({
      nome,
      value: data.total,
      percent: total > 0 ? (data.total / total) * 100 : 0
    }));
  }, [reportData]);

  const COLORS = ["#1E3A5F", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6"];

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) return;
    const headers = ["Aluno", "CTR", "Data Matrícula", "Vendedora", "Pacote", "Origem", "Valor Total"];
    const csvContent = [
      headers.join(","),
      ...reportData.map(r => [
        `"${r.alunoNome}"`,
        r.alunoCtr,
        formatDate(r.dataMatricula),
        `"${r.vendedora}"`,
        `"${r.pacoteNome}"`,
        `"${r.origem}"`,
        r.valorTotal.toFixed(2)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-vendas-${filters.startDate}-a-${filters.endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Início</label>
              <Input 
                type="date" 
                value={filters.startDate} 
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Fim</label>
              <Input 
                type="date" 
                value={filters.endDate} 
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Vendedora</label>
              <Select value={filters.vendedora} onValueChange={(v) => setFilters(prev => ({ ...prev, vendedora: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Gislaine">Gislaine</SelectItem>
                  <SelectItem value="Vera">Vera</SelectItem>
                  <SelectItem value="Gabrielly">Gabrielly</SelectItem>
                  <SelectItem value="Maria Eduarda">Maria Eduarda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Pacote</label>
              <Select value={filters.pacote} onValueChange={(v) => setFilters(prev => ({ ...prev, pacote: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {pacotes?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Origem</label>
              <Select value={filters.origem} onValueChange={(v) => setFilters(prev => ({ ...prev, origem: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="Meta">Meta</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-[#1E3A5F] to-[#2a528a] text-white">
          <CardContent className="pt-6 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-xs font-medium uppercase">Matrículas</p>
                <h3 className="text-2xl font-black mt-1">{stats.totalMatriculas}</h3>
              </div>
              <Users className="h-6 w-6 text-white/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-primary/20">
          <CardContent className="pt-6 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">📋 Contrato</p>
                <h3 className="text-2xl font-black mt-1 text-primary">{formatCurrency(stats.valorTotal)}</h3>
              </div>
              <Package className="h-6 w-6 text-primary/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-[#10b981]/20 shadow-sm">
          <CardContent className="pt-6 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">💰 Recebido</p>
                <h3 className="text-2xl font-black mt-1 text-[#10b981]">{formatCurrency(stats.valorRecebido)}</h3>
              </div>
              <TrendingUp className="h-6 w-6 text-[#10b981]/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-orange-500/20">
          <CardContent className="pt-6 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">⏳ Em Aberto</p>
                <h3 className="text-2xl font-black mt-1 text-orange-500">{formatCurrency(stats.valorEmAberto)}</h3>
              </div>
              <BarChart3 className="h-6 w-6 text-orange-500/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-slate-200">
          <CardContent className="pt-6 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Ticket Médio</p>
                <h3 className="text-2xl font-black mt-1 text-slate-700">{formatCurrency(stats.ticketMedio)}</h3>
              </div>
              <BarChart3 className="h-6 w-6 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Vendas por Vendedora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {vendedorasStats.map((v) => (
              <div key={v.id} className="p-4 rounded-xl border border-muted-foreground/10 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-black text-base">{v.nome}</p>
                    <p className="text-xs text-muted-foreground">{v.total} matrículas</p>
                  </div>
                  <Progress value={v.percent} className="h-2 w-24" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-[#10b981]/10 p-2 rounded-lg border border-[#10b981]/20">
                    <p className="text-[10px] text-[#10b981] font-bold uppercase mb-1">💰 Recebido</p>
                    <p className="font-black text-sm text-[#10b981]">{formatCurrency(v.valorRecebido)}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">📋 Contrato</p>
                    <p className="font-black text-sm text-slate-700">{formatCurrency(v.valor)}</p>
                  </div>
                  <div className="bg-orange-50 p-2 rounded-lg border border-orange-200">
                    <p className="text-[10px] text-orange-600 font-bold uppercase mb-1">⏳ Em Aberto</p>
                    <p className="font-black text-sm text-orange-600">{formatCurrency(v.valorEmAberto)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Vendas por Pacote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pacotesStats.slice(0, 6).map((p) => (
                <div key={p.nome} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/20 transition-all">
                  <div className="flex-1">
                    <p className="font-bold text-sm truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.total} matrículas</p>
                  </div>
                  <p className="font-bold text-primary ml-4">{formatCurrency(p.valor)}</p>
                </div>
              ))}
              {pacotesStats.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Vendas por Origem
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              {origensStats.map((o) => (
                <div key={o.nome} className="flex items-center justify-between border-b border-muted pb-2 last:border-0">
                  <span className="text-sm font-medium">{o.nome}</span>
                  <div className="text-right">
                    <p className="font-bold text-sm">{o.value}</p>
                    <p className="text-[10px] text-muted-foreground">{o.percent.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={origensStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {origensStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Distribuição Visual de Origens
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={origensStats}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent).toFixed(0)}%`}
                >
                  {origensStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Tabela Detalhada de Vendas</CardTitle>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Aluno</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedora</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.alunoNome}</TableCell>
                    <TableCell>{formatDate(r.dataMatricula)}</TableCell>
                    <TableCell>{r.vendedora}</TableCell>
                    <TableCell>
                      <span className="text-xs">{r.pacoteNome}</span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-xs px-2 py-1 bg-muted rounded-full">
                        {r.origem}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(r.valorTotal)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!reportData || reportData.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Nenhuma venda encontrada no período selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
