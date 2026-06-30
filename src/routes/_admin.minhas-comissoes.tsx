import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/minhas-comissoes")({
  head: () => ({ meta: [{ title: "Minhas Comissões — Soluções Online" }] }),
  component: MinhasComissoes,
});

function MinhasComissoes() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [period, setPeriod] = useState({
    start: format(startOfMonth(today), "yyyy-MM-dd"),
    end: format(endOfMonth(today), "yyyy-MM-dd"),
  });

  const { data: colaborador, isLoading: loadingColab } = useQuery({
    queryKey: ["colaborador-vendedor", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome, setor, ativo")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isVendedor = colaborador?.setor === "Vendedor" && colaborador?.ativo;

  useEffect(() => {
    if (authLoading || loadingColab) return;
    if (!isVendedor) navigate({ to: "/" });
  }, [authLoading, loadingColab, isVendedor, navigate]);

  const { data: comissoes, isLoading } = useQuery({
    queryKey: ["minhas-comissoes", colaborador?.nome, period],
    enabled: !!colaborador?.nome,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("id, valor, status, tipo_pagamento, competencia, data_pagamento, created_at, estornado, aluno:alunos(nome, ctr)")
        .eq("vendedora", colaborador!.nome)
        .eq("estornado", false)
        .gte("competencia", period.start)
        .lte("competencia", period.end)
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = useMemo(
    () => (comissoes ?? []).reduce((s, c: any) => s + Number(c.valor || 0), 0),
    [comissoes]
  );
  const totalPago = useMemo(
    () => (comissoes ?? []).filter((c: any) => c.status === "pago").reduce((s, c: any) => s + Number(c.valor || 0), 0),
    [comissoes]
  );
  const totalPendente = total - totalPago;

  if (authLoading || loadingColab) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isVendedor) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Minhas Comissões" description={`Olá, ${colaborador?.nome}`} icon={Wallet} />

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Data início</Label>
            <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </div>
          <div>
            <Label>Data fim</Label>
            <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total no período</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Pago</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPago)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Pendente</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(comissoes ?? []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.aluno?.nome ?? "—"}</TableCell>
                    <TableCell>{c.aluno?.ctr ?? "—"}</TableCell>
                    <TableCell className="capitalize">{c.tipo_pagamento}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "pago" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.competencia ? formatDate(c.competencia) : "—"}</TableCell>
                    <TableCell>{c.data_pagamento ? formatDate(c.data_pagamento) : "—"}</TableCell>
                  </TableRow>
                ))}
                {(comissoes ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma comissão no período selecionado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
