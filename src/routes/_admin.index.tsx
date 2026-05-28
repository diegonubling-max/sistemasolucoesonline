import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, GraduationCap, UserCheck, Wallet, Landmark, AlertCircle, TrendingUp, Search, Smartphone, Users as UserGroup, Pin } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/")({
  head: () => ({ meta: [{ title: "Dashboard — EduManager" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const firstDay = startOfMonth(today);
      const lastDay = endOfMonth(today);

      const [a, c, m, aa, pagoMes, abertoMes, atrasado, totalAberto, origensData] = await Promise.all([
        supabase.from("alunos").select("*", { count: "exact", head: true }),
        supabase.from("cursos").select("*", { count: "exact", head: true }),
        supabase.from("matriculas").select("*", { count: "exact", head: true }),
        supabase.from("alunos").select("*", { count: "exact", head: true }).eq("ativo", true),
        // Faturamento
        supabase.from("parcelas").select("valor, valor_liquido, forma_pagamento").eq("status", "pago").gte("data_pagamento", format(firstDay, "yyyy-MM-dd")).lte("data_pagamento", format(lastDay, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").eq("status", "aberto").gte("data_vencimento", format(firstDay, "yyyy-MM-dd")).lte("data_vencimento", format(lastDay, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").eq("status", "aberto").lt("data_vencimento", format(today, "yyyy-MM-dd")),
        supabase.from("parcelas").select("valor").neq("status", "isento"),
        supabase.from("alunos").select("origem"),
      ]);

      const sum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => acc + Number(curr.valor), 0);
      const receivedSum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => {
        const isCartao = curr.forma_pagamento === 'cartao';
        const val = isCartao && curr.valor_liquido ? Number(curr.valor_liquido) : Number(curr.valor);
        return acc + val;
      }, 0);

      // Calcular origens
      const origensMap = (origensData.data ?? []).reduce((acc: Record<string, number>, curr) => {
        const key = curr.origem || 'Outros';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const totalAlunos = a.count ?? 0;
      const origens = Object.entries(origensMap)
        .map(([name, count]) => ({
          name,
          count,
          percent: totalAlunos > 0 ? Math.round((count / totalAlunos) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);

      return {
        alunos: totalAlunos,
        cursos: c.count ?? 0,
        matriculas: m.count ?? 0,
        ativos: aa.count ?? 0,
        origens,
        faturamento: {
          recebido: receivedSum(pagoMes.data),
          aReceberMes: sum(abertoMes.data),
          atrasado: sum(atrasado.data),
          totalGeral: sum(totalAberto.data),
        }
      };
    },
  });

  const { data: recentes } = useQuery({
    queryKey: ["alunos-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, email, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const cards = [
    { label: "Total de Alunos", value: stats?.alunos ?? 0, icon: Users, color: "text-primary" },
    { label: "Total de Matrículas", value: stats?.matriculas ?? 0, icon: GraduationCap, color: "text-primary" },
    { label: "Alunos Ativos", value: stats?.ativos ?? 0, icon: UserCheck, color: "text-accent" },
  ];

  const faturamentoCards = [
    { label: "Total Recebido no Mês", value: formatCurrency(stats?.faturamento?.recebido ?? 0), icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "A Receber no Mês", value: formatCurrency(stats?.faturamento?.aReceberMes ?? 0), icon: Landmark, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Em Atraso", value: formatCurrency(stats?.faturamento?.atrasado ?? 0), icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do EduManager" />

      <h2 className="text-xl font-bold mb-4">Faturamento</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {faturamentoCards.map((c) => {
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

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Origem das Matrículas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {(stats?.origens ?? []).map((o) => {
              let Icon = Pin;
              if (o.name.toLowerCase().includes("google")) Icon = Search;
              else if (o.name.toLowerCase().includes("meta") || o.name.toLowerCase().includes("facebook") || o.name.toLowerCase().includes("instagram")) Icon = Smartphone;
              else if (o.name.toLowerCase().includes("indicação") || o.name.toLowerCase().includes("indicacao")) Icon = UserGroup;

              return (
                <div key={o.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-100 rounded-md">
                        <Icon className="h-4 w-4 text-gray-600" />
                      </div>
                      <span className="font-medium text-gray-700">{o.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{o.count} {o.count === 1 ? 'aluno' : 'alunos'}</span>
                      <span className="font-bold text-gray-900 w-10 text-right">{o.percent}%</span>
                    </div>
                  </div>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                    <div 
                      className="h-full bg-[#1E3A5F] transition-all duration-1000 ease-out" 
                      style={{ width: `${o.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!stats?.origens || stats.origens.length === 0) && (
              <p className="text-center text-muted-foreground py-4">Nenhuma origem registrada.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="text-3xl font-bold mt-1">{c.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${c.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos alunos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentes ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <Link to="/alunos/$id" params={{ id: a.id }} className="hover:text-primary">
                      {a.nome}
                    </Link>
                  </TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{formatDate(a.created_at)}</TableCell>
                </TableRow>
              ))}
              {recentes && recentes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Nenhum aluno cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}