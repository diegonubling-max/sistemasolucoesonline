import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, UserCheck, Wallet, Landmark, AlertCircle, TrendingUp, Search, Smartphone, Users as UserGroup, Pin, Loader2, Crown, LogIn, Circle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { startOfMonth, endOfMonth, format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDate } from "@/lib/format";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { VitrineInteresse } from "@/components/admin/VitrineInteresse";


export const Route = createFileRoute("/_admin/")({
  head: () => ({ meta: [{ title: "Dashboard — EduManager" }] }),
  component: Dashboard,
});

interface Origin {
  name: string;
  count: number;
  percent: number;
}

function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => sessionStorage.getItem("selected_polo_id") || "all");

  useEffect(() => {
    const handlePoloChange = () => {
      setSelectedPoloId(sessionStorage.getItem("selected_polo_id") || "all");
      console.log("DEBUG [Dashboard]: Polo alterado para:", sessionStorage.getItem("selected_polo_id"));
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
      const { data } = await supabase.from('colaboradores').select('polo_id, responsavel_polo').eq('user_id', session.user.id).maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id
  });

  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';
  const isResponsavel = !!(colabData as any)?.responsavel_polo;

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

  const { data: polos } = useQuery({
    queryKey: ["polos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("polos").select("id, nome").eq("ativo", true);
      if (error) throw error;
      return data;
    }
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["dashboard-stats", selectedPoloId, userRole, colabData],
    queryFn: async () => {
      const today = new Date();
      const firstDay = startOfMonth(today);
      const lastDay = endOfMonth(today);


      const [a, c, m, aa, pagoMes, abertoMes, atrasado, totalAberto, origensData, colabAtivos] = await Promise.all([
        filterByPolo(supabase.from("alunos").select("*", { count: "exact", head: true })),
        supabase.from("cursos").select("*", { count: "exact", head: true }),
        filterByPolo(supabase.from("matriculas").select("*", { count: "exact", head: true })),
        filterByPolo(supabase.from("alunos").select("*", { count: "exact", head: true }).eq("ativo", true)),
        filterByPolo(supabase.from("parcelas").select("valor, valor_liquido, forma_pagamento").eq("status", "pago").gte("data_pagamento", format(firstDay, "yyyy-MM-dd")).lte("data_pagamento", format(lastDay, "yyyy-MM-dd"))),
        filterByPolo(supabase.from("parcelas").select("valor").eq("status", "aberto").gte("data_vencimento", format(firstDay, "yyyy-MM-dd")).lte("data_vencimento", format(lastDay, "yyyy-MM-dd"))),
        filterByPolo(supabase.from("parcelas").select("valor").eq("status", "aberto").lt("data_vencimento", format(today, "yyyy-MM-dd"))),
        filterByPolo(supabase.from("parcelas").select("valor").neq("status", "isento")),
        filterByPolo(supabase.from("alunos").select("origem")),
        filterByPolo(supabase.from("colaboradores").select("*", { count: "exact", head: true }).eq("ativo", true)),
      ]);

      const sum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => acc + Number(curr.valor), 0);
      const receivedSum = (items: any[] | null) => (items ?? []).reduce((acc, curr) => {
        const isCartao = curr.forma_pagamento === 'cartao';
        const val = isCartao && curr.valor_liquido ? Number(curr.valor_liquido) : Number(curr.valor);
        return acc + val;
      }, 0);

      const origensMap = (origensData.data ?? []).reduce((acc: Record<string, number>, curr: any) => {
        const key = curr.origem || 'Outros';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const totalAlunos = a.count ?? 0;
      const origens: Origin[] = Object.entries(origensMap)
        .map(([name, count]: [string, any]) => ({
          name,
          count: Number(count),
          percent: totalAlunos > 0 ? Math.round((Number(count) / totalAlunos) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);

      let statsByPolo: any[] = [];
      if (selectedPoloId === 'all' && polos) {
        const poloPromises = polos.map(async (p) => {
          const [alunosPolo, recebidoPolo, matriculasMesPolo] = await Promise.all([
            supabase.from("alunos").select("*", { count: "exact", head: true }).eq("polo_id", p.id),
            supabase.from("parcelas").select("valor, valor_liquido, forma_pagamento").eq("status", "pago").eq("polo_id", p.id).gte("data_pagamento", format(firstDay, "yyyy-MM-dd")).lte("data_pagamento", format(lastDay, "yyyy-MM-dd")),
            supabase.from("matriculas").select("*", { count: "exact", head: true }).eq("polo_id", p.id).gte("created_at", format(firstDay, "yyyy-MM-dd"))
          ]);

          return {
            poloNome: p.nome,
            alunos: alunosPolo.count || 0,
            recebido: receivedSum(recebidoPolo.data),
            matriculasMes: matriculasMesPolo.count || 0
          };
        });
        statsByPolo = await Promise.all(poloPromises);
      }

      return {
        alunos: totalAlunos,
        cursos: c.count ?? 0,
        matriculas: m.count ?? 0,
        ativos: aa.count ?? 0,
        colaboradoresAtivos: colabAtivos.count ?? 0,
        origens,
        faturamento: {
          recebido: receivedSum(pagoMes.data),
          aReceberMes: sum(abertoMes.data),
          atrasado: sum(atrasado.data),
          totalGeral: sum(totalAberto.data),
        },
        statsByPolo
      };
    },
  });

  const { data: recentes } = useQuery({
    queryKey: ["alunos-recentes", selectedPoloId],
    queryFn: async () => {
      let q = supabase
        .from("alunos")
        .select("id, nome, email, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (selectedPoloId && selectedPoloId !== 'all') {
        q = q.eq('polo_id', selectedPoloId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: ultimosAcessos } = useQuery({
    queryKey: ["ultimos-acessos", selectedPoloId, colabData?.polo_id, isSuperAdmin],
    queryFn: async () => {
      const desde = subDays(new Date(), 5).toISOString();
      let q = supabase
        .from("aluno_sessoes")
        .select("aluno_id, login_em, alunos!inner(id, nome, ctr, polo_id, polos(nome))")
        .gte("login_em", desde)
        .order("login_em", { ascending: false })
        .limit(200);

      const colabPoloId = colabData?.polo_id;
      if (isSuperAdmin) {
        if (selectedPoloId && selectedPoloId !== 'all') {
          q = q.eq('alunos.polo_id', selectedPoloId);
        }
      } else if (colabPoloId) {
        q = q.eq('alunos.polo_id', colabPoloId);
      }

      const { data, error } = await q;
      if (error) throw error;

      const seen = new Set<string>();
      const unique: any[] = [];
      for (const row of data ?? []) {
        if (seen.has(row.aluno_id)) continue;
        seen.add(row.aluno_id);
        unique.push(row);
        if (unique.length >= 10) break;
      }
      return unique;
    },
  });

  const { data: alunosOnline } = useQuery({
    queryKey: ["alunos-online", selectedPoloId, colabData?.polo_id, isSuperAdmin],
    refetchInterval: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      let q = supabase
        .from("aluno_sessoes")
        .select("aluno_id, login_em, alunos!inner(id, nome, ctr, foto_perfil, polo_id)")
        .gte("login_em", desde)
        .order("login_em", { ascending: false })
        .limit(100);

      const colabPoloId = colabData?.polo_id;
      if (isSuperAdmin) {
        if (selectedPoloId && selectedPoloId !== 'all') q = q.eq('alunos.polo_id', selectedPoloId);
      } else if (colabPoloId) {
        q = q.eq('alunos.polo_id', colabPoloId);
      }

      const { data, error } = await q;
      if (error) throw error;
      const seen = new Set<string>();
      const unique: any[] = [];
      for (const r of data ?? []) {
        if (seen.has(r.aluno_id)) continue;
        seen.add(r.aluno_id);
        unique.push(r);
      }
      return unique;
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

  if (isLoadingStats) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader 
        title="Dashboard" 
        description={selectedPoloId === 'all' ? "Visão geral de todos os polos" : `Visão geral: ${polos?.find(p => p.id === selectedPoloId)?.nome || 'Polo selecionado'}`} 
      />

      {isResponsavel && !isSuperAdmin && (
        <Card className="mb-6 border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900">
                  Você é o Responsável pelo {polos?.find(p => p.id === colabData?.polo_id)?.nome || 'seu polo'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-amber-700 uppercase font-semibold">Colaboradores Ativos</p>
                    <p className="text-2xl font-bold text-amber-900">{stats?.colaboradoresAtivos ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 uppercase font-semibold">Total de Alunos</p>
                    <p className="text-2xl font-bold text-amber-900">{stats?.alunos ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 uppercase font-semibold">Faturamento do Mês</p>
                    <p className="text-2xl font-bold text-amber-900">{formatCurrency(stats?.faturamento?.recebido ?? 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <VitrineInteresse selectedPoloId={selectedPoloId} colabPoloId={colabData?.polo_id} isSuperAdmin={isSuperAdmin} />

      {/* Cards por Polo - ocultos temporariamente
      {selectedPoloId === 'all' && stats?.statsByPolo && stats.statsByPolo.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            Cards por Polo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.statsByPolo.map((poloStat: any) => (
              <Card key={poloStat.poloNome} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-primary flex justify-between items-center">
                    {poloStat.poloNome}
                    <Badge variant="outline" className="font-normal">Polo</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Total Alunos:</span>
                    <span className="text-sm font-bold">{poloStat.alunos}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Recebido Mês:</span>
                    <span className="text-sm font-bold text-green-600">{formatCurrency(poloStat.recebido)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Matrículas Mês:</span>
                    <span className="text-sm font-bold text-blue-600">{poloStat.matriculasMes}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      */}



      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <div className="w-1 h-6 bg-green-500 rounded-full" />
        Faturamento {selectedPoloId !== 'all' && 'do Polo'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {faturamentoCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="border-l-4 border-l-primary/20 hover:border-l-primary transition-all">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="text-2xl font-bold mt-1 tracking-tight">{c.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${c.bg}`}>
                    <Icon className={`h-6 w-6 ${c.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <UserGroup className="h-5 w-5 text-primary" />
              Origem das Matrículas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(stats?.origens ?? []).map((o: Origin) => {
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
                    <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-100">
                      <div 
                        className="h-full bg-primary transition-all duration-1000 ease-out" 
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

        <div className="space-y-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label} className="bg-gradient-to-br from-white to-gray-50/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">{c.label}</p>
                      <p className="text-3xl font-bold mt-1 tracking-tighter">{c.value}</p>
                    </div>
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                      <Icon className={`h-8 w-8 ${c.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>



      <Card className="mb-8 border-none shadow-lg">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Circle className="h-3 w-3 fill-green-500 text-green-500 animate-pulse" />
            Alunos Online Agora
            {alunosOnline && alunosOnline.length > 0 && (
              <Badge variant="secondary" className="ml-2">{alunosOnline.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {(!alunosOnline || alunosOnline.length === 0) ? (
            <p className="text-center text-muted-foreground py-6 italic">Nenhum aluno online no momento</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {alunosOnline.map((s: any) => {
                const mins = Math.max(0, Math.floor((Date.now() - new Date(s.login_em).getTime()) / 60000));
                const inicial = (s.alunos.nome || '?').charAt(0).toUpperCase();
                return (
                  <div
                    key={s.aluno_id}
                    onClick={() => navigate({ to: "/alunos/$id", params: { id: s.alunos.id } })}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/60 cursor-pointer transition-colors"
                  >
                    <div className="relative">
                      {s.alunos.foto_perfil ? (
                        <img src={s.alunos.foto_perfil} alt={s.alunos.nome} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {inicial}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-primary truncate">{s.alunos.nome}</p>
                      <p className="text-xs text-muted-foreground">CTR {s.alunos.ctr ?? '-'} • há {mins === 0 ? 'menos de 1' : mins} min</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-8 border-none shadow-lg">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            Últimos Acessos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(!ultimosAcessos || ultimosAcessos.length === 0) ? (
            <p className="text-center text-muted-foreground py-8 italic">Nenhum acesso recente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Nome</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="pr-6">Polo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimosAcessos.map((s: any) => (
                  <TableRow
                    key={s.aluno_id}
                    className="group transition-colors cursor-pointer hover:bg-muted/60"
                    onClick={() => navigate({ to: "/alunos/$id", params: { id: s.alunos.id } })}
                  >
                    <TableCell className="font-medium pl-6 text-primary">{s.alunos.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{s.alunos.ctr ?? '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(s.login_em), "dd/MM 'às' HH:mm")}</TableCell>
                    <TableCell className="text-muted-foreground pr-6">{s.alunos.polos?.nome ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      <Card className="border-none shadow-lg">

        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Últimos alunos cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="pr-6">Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentes ?? []).map((a) => (
                <TableRow key={a.id} className="group transition-colors">
                  <TableCell className="font-medium pl-6">
                    <Link to="/alunos/$id" params={{ id: a.id }} className="hover:text-primary flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {a.nome.charAt(0)}
                      </div>
                      {a.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-muted-foreground pr-6">{formatDate(a.created_at)}</TableCell>
                </TableRow>
              ))}
              {recentes && recentes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-10 italic">
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