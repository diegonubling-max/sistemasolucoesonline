import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { FileDown, Users, Target, Percent, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

const VENDEDORAS = ["Gislaine", "Vera", "Gabrielly", "Maria Eduarda"];
const ORIGENS = ["Google", "Meta", "Indicação", "Outros"];

export function PerformanceAnalysis() {
  const [period, setPeriod] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [vendedora, setVendedora] = useState("todas");

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["performance-metrics", period, vendedora],
    queryFn: async () => {
      // 1. Fetch Leads
      let leadsQuery = supabase
        .from("leads_diarios")
        .select("*")
        .gte("data", period.start)
        .lte("data", period.end);
      
      if (vendedora !== "todas") {
        leadsQuery = leadsQuery.eq("vendedora", vendedora);
      }
      
      const { data: leadsData } = await leadsQuery;

      // 2. Fetch Enrollments (Matriculas)
      let matriculasQuery = supabase
        .from("matriculas")
        .select(`
          id,
          created_at,
          alunos!inner (
            nome,
            vendedora,
            origem
          ),
          matricula_pacotes (
            pacotes (
              valor_total
            )
          ),
          parcelas (
            forma_pagamento,
            tipo
          )
        `)
        .gte("created_at", `${period.start}T00:00:00`)
        .lte("created_at", `${period.end}T23:59:59`);

      if (vendedora !== "todas") {
        matriculasQuery = matriculasQuery.eq("alunos.vendedora", vendedora);
      }

      const { data: matriculasData } = await matriculasQuery;

      // Processing
      const totalLeads = (leadsData || []).reduce((acc, curr) => acc + curr.quantidade, 0);
      const totalMatriculas = (matriculasData || []).length;
      
      const leadsByOrigin = ORIGENS.reduce((acc, org) => {
        acc[org] = (leadsData || [])
          .filter(l => l.origem === org)
          .reduce((s, curr) => s + curr.quantidade, 0);
        return acc;
      }, {} as Record<string, number>);

      const matriculasByOrigin = ORIGENS.reduce((acc, org) => {
        acc[org] = (matriculasData || [])
          .filter(m => (m.alunos as any).origem === org)
          .length;
        return acc;
      }, {} as Record<string, number>);

      // Payment method analysis
      let aVistaCartao = 0;
      let boletoCarne = 0;
      
      const paymentByOrigin = ORIGENS.reduce((acc, org) => {
        acc[org] = { aVista: 0, parcelado: 0 };
        return acc;
      }, {} as Record<string, { aVista: number, parcelado: number }>);

      (matriculasData || []).forEach(m => {
        const origin = (m.alunos as any).origem;
        const parcelas = m.parcelas as any[];
        
        // Simple heuristic: if any parcela is boleto or more than 1 parcela, it's usually considered installment/carnê
        // But let's follow user requirement: PIX/Cartão vs Boleto/Carnê
        const isBoletoCarne = parcelas.some(p => p.forma_pagamento === 'boleto' || p.tipo === 'mensalidade');
        
        if (isBoletoCarne) {
          boletoCarne++;
          if (paymentByOrigin[origin]) paymentByOrigin[origin].parcelado++;
        } else {
          aVistaCartao++;
          if (paymentByOrigin[origin]) paymentByOrigin[origin].aVista++;
        }
      });

      // Comparative Table Data
      const vendedorasData = VENDEDORAS.map(v => {
        const vLeads = (leadsData || []).filter(l => l.vendedora === v);
        const vMatriculas = (matriculasData || []).filter(m => (m.alunos as any).vendedora === v);
        
        const vLeadsByOrigin = ORIGENS.reduce((acc, org) => {
          acc[org] = vLeads.filter(l => l.origem === org).reduce((s, curr) => s + curr.quantidade, 0);
          return acc;
        }, {} as Record<string, number>);

        const vMatByOrigin = ORIGENS.reduce((acc, org) => {
          acc[org] = vMatriculas.filter(m => (m.alunos as any).origem === org).length;
          return acc;
        }, {} as Record<string, number>);

        const totalValue = vMatriculas.reduce((acc, m) => {
          const pacotes = (m.matricula_pacotes as any[]).map(mp => mp.pacotes);
          return acc + pacotes.reduce((s, p) => s + Number(p?.valor_total || 0), 0);
        }, 0);

        return {
          vendedora: v,
          leads: vLeadsByOrigin,
          matriculas: vMatByOrigin,
          totalLeads: vLeads.reduce((acc, curr) => acc + curr.quantidade, 0),
          totalMatriculas: vMatriculas.length,
          ticketMedio: vMatriculas.length > 0 ? totalValue / vMatriculas.length : 0
        };
      });

      return {
        totalLeads,
        totalMatriculas,
        leadsByOrigin,
        matriculasByOrigin,
        aVistaCartao,
        boletoCarne,
        paymentByOrigin,
        vendedorasData
      };
    }
  });

  const exportCSV = () => {
    if (!metrics) return;
    const headers = ["Vendedora", "Leads Google", "Leads Meta", "Leads Indicação", "Matrículas Google", "Matrículas Meta", "Matrículas Indicação", "Aproveitamento %", "Ticket Médio"];
    
    const csvContent = [
      headers.join(","),
      ...metrics.vendedorasData.map(v => [
        v.vendedora,
        v.leads["Google"],
        v.leads["Meta"],
        v.leads["Indicação"],
        v.matriculas["Google"],
        v.matriculas["Meta"],
        v.matriculas["Indicação"],
        v.totalLeads > 0 ? ((v.totalMatriculas / v.totalLeads) * 100).toFixed(1) + "%" : "0%",
        v.ticketMedio.toFixed(2)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `performance-vendas-${period.start}-a-${period.end}.csv`;
    link.click();
  };

  const chartData = metrics ? ORIGENS.map(org => ({
    name: org,
    value: metrics.leadsByOrigin[org] || 0
  })).filter(d => d.value > 0) : [];

  const COLORS = ["#4285F4", "#1877F2", "#34A853", "#FBBC05"];

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input type="date" value={period.start} onChange={e => setPeriod(prev => ({ ...prev, start: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input type="date" value={period.end} onChange={e => setPeriod(prev => ({ ...prev, end: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Vendedora</Label>
              <Select value={vendedora} onValueChange={setVendedora}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {VENDEDORAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase font-semibold">Total Leads</p>
              <p className="text-3xl font-bold">{metrics?.totalLeads || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase font-semibold">Total Matrículas</p>
              <p className="text-3xl font-bold">{metrics?.totalMatriculas || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Target className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase font-semibold">Aproveitamento Geral</p>
              <p className="text-3xl font-bold">
                {metrics?.totalLeads && metrics.totalLeads > 0 
                  ? ((metrics.totalMatriculas / metrics.totalLeads) * 100).toFixed(1) 
                  : 0}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Percent className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aproveitamento por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ORIGENS.map(org => {
                const leads = metrics?.leadsByOrigin[org] || 0;
                const mat = metrics?.matriculasByOrigin[org] || 0;
                const rate = leads > 0 ? (mat / leads) * 100 : 0;
                return (
                  <div key={org} className="space-y-1">
                    <div className="flex justify-between text-sm font-medium">
                      <span>{org}</span>
                      <span>{mat} / {leads} ({rate.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análise por Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-center justify-around p-6 bg-gray-50 rounded-xl">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">À vista / Cartão</p>
                  <p className="text-2xl font-bold text-green-600">{metrics?.aVistaCartao || 0}</p>
                </div>
                <div className="h-10 w-px bg-gray-300"></div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Boleto / Carnê</p>
                  <p className="text-2xl font-bold text-orange-600">{metrics?.boletoCarne || 0}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground">Composição por Origem</h4>
              {ORIGENS.map(org => {
                const data = metrics?.paymentByOrigin[org];
                const total = (data?.aVista || 0) + (data?.parcelado || 0);
                const aVistaRate = total > 0 ? (data!.aVista / total) * 100 : 0;
                const parceladoRate = total > 0 ? (data!.parcelado / total) * 100 : 0;
                
                return (
                  <div key={org} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{org}</span>
                      <span>À vista {aVistaRate.toFixed(0)}% | Parcelado {parceladoRate.toFixed(0)}%</span>
                    </div>
                    <div className="flex w-full h-2 rounded-full overflow-hidden">
                      <div className="bg-green-500" style={{ width: `${aVistaRate}%` }}></div>
                      <div className="bg-orange-500" style={{ width: `${parceladoRate}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Comparativo entre Vendedoras</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedora</TableHead>
                <TableHead>Leads (G/M/I)</TableHead>
                <TableHead>Matrículas (G/M/I)</TableHead>
                <TableHead>Aproveitamento %</TableHead>
                <TableHead>Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics?.vendedorasData.map((v) => (
                <TableRow key={v.vendedora}>
                  <TableCell className="font-medium">{v.vendedora}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.leads["Google"]} / {v.leads["Meta"]} / {v.leads["Indicação"]}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {v.matriculas["Google"]} / {v.matriculas["Meta"]} / {v.matriculas["Indicação"]}
                  </TableCell>
                  <TableCell>
                    {v.totalLeads > 0 ? ((v.totalMatriculas / v.totalLeads) * 100).toFixed(1) : 0}%
                  </TableCell>
                  <TableCell>{formatCurrency(v.ticketMedio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
