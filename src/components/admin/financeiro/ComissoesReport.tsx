import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, CheckCircle, Loader2, Eye, DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";

interface ComissaoRow {
  id: string;
  vendedora: string;
  aluno_id: string | null;
  matricula_id: string | null;
  tipo_pagamento: string;
  valor: number;
  status: string | null;
  competencia: string;
  data_pagamento: string | null;
  estornado: boolean;
  estorno_competencia: string | null;
  created_at: string;
  alunos?: { nome: string | null; ctr: number | null; polo_id: string | null } | null;
}

export function ComissoesReport({ poloId = "all" }: { poloId?: string }) {
  const qc = useQueryClient();
  const [mes, setMes] = useState<string>(format(new Date(), "yyyy-MM"));
  const [openVendedora, setOpenVendedora] = useState<string | null>(null);

  const { competencia, mesInicio, mesFim, tituloMes } = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return {
      competencia: format(first, "yyyy-MM-dd"),
      mesInicio: format(first, "yyyy-MM-dd"),
      mesFim: format(last, "yyyy-MM-dd"),
      tituloMes: format(first, "MM/yyyy"),
    };
  }, [mes]);

  const dataPagamentoPrevista = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    return format(new Date(y, m, 20), "yyyy-MM-dd"); // dia 20 do mês seguinte
  }, [mes]);


  const { data: comissoes, isLoading } = useQuery({
    queryKey: ["comissoes", mesInicio, mesFim, poloId],
    queryFn: async () => {
      const filtraPolo = poloId && poloId !== "all";
      let query = supabase
        .from("comissoes")
        .select(filtraPolo ? "*, alunos!inner(nome, ctr, polo_id)" : "*, alunos(nome, ctr, polo_id)")
        .or(
          `and(competencia.gte.${mesInicio},competencia.lte.${mesFim}),and(estorno_competencia.gte.${mesInicio},estorno_competencia.lte.${mesFim})`,
        )
        .order("competencia", { ascending: false });
      if (filtraPolo) query = query.eq("alunos.polo_id", poloId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ComissaoRow[];
    },
  });



  const marcarPago = useMutation({
    mutationFn: async (vendedora: string) => {
      const { error } = await supabase
        .from("comissoes")
        .update({ status: "pago", data_pagamento: dataPagamentoPrevista })
        .eq("vendedora", vendedora)
        .eq("competencia", competencia)
        .neq("status", "pago");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comissões marcadas como pagas!");
      qc.invalidateQueries({ queryKey: ["comissoes", competencia] });
    },
    onError: (e: Error) => toast.error("Erro ao marcar como pago", { description: e.message }),
  });

  // Agrupa por vendedora
  const grupos = useMemo(() => {
    const map = new Map<string, {
      vendedora: string;
      vendas: ComissaoRow[];
      estornos: ComissaoRow[];
      totalGerado: number;
      totalEstornos: number;
      liquido: number;
      todasPagas: boolean;
    }>();
    for (const c of comissoes ?? []) {
      const g = map.get(c.vendedora) ?? {
        vendedora: c.vendedora,
        vendas: [],
        estornos: [],
        totalGerado: 0,
        totalEstornos: 0,
        liquido: 0,
        todasPagas: true,
      };
      const isEstornoDoMes = c.estornado && c.estorno_competencia === competencia;
      const isGeradaDoMes = c.competencia === competencia;
      if (isGeradaDoMes) {
        g.vendas.push(c);
        if (!c.estornado) g.totalGerado += Number(c.valor);
        if (c.status !== "pago") g.todasPagas = false;
      }
      if (isEstornoDoMes) {
        g.estornos.push(c);
        g.totalEstornos += Number(c.valor);
      }
      g.liquido = g.totalGerado - g.totalEstornos;
      map.set(c.vendedora, g);
    }
    return Array.from(map.values()).sort((a, b) => a.vendedora.localeCompare(b.vendedora));
  }, [comissoes, competencia]);

  return (
    <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            Comissões — competência {format(new Date(mes + "-01"), "MM/yyyy")}
          </h3>
          <div className="flex items-center gap-2">
            <Input type="month" className="w-44" value={mes} onChange={(e) => setMes(e.target.value)} />
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Pagamento previsto: {formatDate(dataPagamentoPrevista)}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedora</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Comissões</TableHead>
                <TableHead className="text-right">Estornos</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma comissão nesta competência.
                  </TableCell>
                </TableRow>
              )}
              {grupos.map((g) => (
                <TableRow
                  key={g.vendedora}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setOpenVendedora(g.vendedora)}
                >
                  <TableCell className="font-medium">{g.vendedora}</TableCell>
                  <TableCell className="text-center">{g.vendas.filter(v => !v.estornado).length}</TableCell>
                  <TableCell className="text-right text-green-700 font-semibold">{formatCurrency(g.totalGerado)}</TableCell>
                  <TableCell className="text-right text-red-600">
                    {g.totalEstornos > 0 ? `- ${formatCurrency(g.totalEstornos)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(g.liquido)}</TableCell>
                  <TableCell className="text-sm">{formatDate(dataPagamentoPrevista)}</TableCell>
                  <TableCell>
                    {g.todasPagas && g.vendas.length > 0 ? (
                      <Badge className="bg-green-500 hover:bg-green-500">Pago</Badge>
                    ) : (
                      <Badge className="bg-yellow-500 hover:bg-yellow-500">A pagar</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={g.todasPagas || g.liquido <= 0 || marcarPago.isPending}
                      onClick={(e) => { e.stopPropagation(); marcarPago.mutate(g.vendedora); }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Marcar como pago
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!openVendedora} onOpenChange={(o) => !o && setOpenVendedora(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            {(() => {
              const g = grupos.find(x => x.vendedora === openVendedora);
              if (!g) return null;
              const totalAlunos = new Set(g.vendas.filter(v => !v.estornado).map(v => v.aluno_id)).size;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                      Comissões de {g.vendedora} — {format(new Date(mes + "-01"), "MM/yyyy")}
                    </DialogTitle>
                  </DialogHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>CTR</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Gerada em</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.vendas.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>{v.alunos?.nome ?? "—"}</TableCell>
                          <TableCell>{v.alunos?.ctr ?? "—"}</TableCell>
                          <TableCell className="capitalize">{v.tipo_pagamento}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(v.valor))}</TableCell>
                          <TableCell>{formatDate(v.competencia)}</TableCell>
                          <TableCell>
                            {v.estornado ? (
                              <Badge variant="destructive">Estornada</Badge>
                            ) : v.status === "pago" ? (
                              <Badge className="bg-green-500 hover:bg-green-500">Pago</Badge>
                            ) : (
                              <Badge className="bg-yellow-500 hover:bg-yellow-500">A pagar</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {v.aluno_id && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(`/alunos/${v.aluno_id}`, "_blank")}
                                    title="Ver aluno"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(`/alunos/${v.aluno_id}?tab=financeiro`, "_blank")}
                                    title="Financeiro"
                                  >
                                    <DollarSign className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {g.estornos.map((v) => (
                        <TableRow key={`est-${v.id}`} className="bg-red-50/40">
                          <TableCell>{v.alunos?.nome ?? "—"}</TableCell>
                          <TableCell>{v.alunos?.ctr ?? "—"}</TableCell>
                          <TableCell className="capitalize">Estorno — {v.tipo_pagamento}</TableCell>
                          <TableCell className="text-right text-red-600">- {formatCurrency(Number(v.valor))}</TableCell>
                          <TableCell>{formatDate(v.estorno_competencia)}</TableCell>
                          <TableCell><Badge variant="destructive">Estornada</Badge></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <DialogFooter className="border-t pt-4 mt-4">
                    <div className="flex flex-wrap gap-6 w-full justify-between text-sm">
                      <div><span className="text-muted-foreground">Total de alunos:</span> <strong>{totalAlunos}</strong></div>
                      <div><span className="text-muted-foreground">Total de comissões:</span> <strong className="text-green-700">{formatCurrency(g.totalGerado)}</strong></div>
                      <div><span className="text-muted-foreground">Estornos:</span> <strong className="text-red-600">{formatCurrency(g.totalEstornos)}</strong></div>
                      <div><span className="text-muted-foreground">Líquido a pagar:</span> <strong>{formatCurrency(g.liquido)}</strong></div>
                    </div>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}
