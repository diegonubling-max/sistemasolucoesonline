import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, FileDown, Pencil, Check, CircleDollarSign, Undo2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { format, addDays, subDays } from "date-fns";
import { toast } from "sonner";

interface ParcelaFechamento {
  id: string;
  valor: number;
  valor_liquido: number | null;
  forma_pagamento: string | null;
  tipo: string | null;
  data_pagamento: string | null;
  matriculas: {
    alunos: { nome: string | null; ctr: number | null } | null;
  } | null;
}

// Fechamento semanal: sempre às sextas-feiras, cobrindo a sexta-feira anterior (00:00)
// até a quinta-feira seguinte (23:59:59) — 7 dias corridos, fechados no dia seguinte (sexta).
function getClosingFriday(ref: Date): Date {
  const day = ref.getDay(); // 0=domingo ... 5=sexta ... 6=sábado
  const diasAteSexta = (5 - day + 7) % 7;
  return addDays(ref, diasAteSexta);
}

export function FechamentoSemanalReport() {
  const qc = useQueryClient();
  const [closingFriday, setClosingFriday] = useState<Date>(() => getClosingFriday(new Date()));
  const [colaboradorId, setColaboradorId] = useState<string>("");
  const [editandoPercentual, setEditandoPercentual] = useState(false);
  const [percentualInput, setPercentualInput] = useState("30");

  const periodStart = format(subDays(closingFriday, 7), "yyyy-MM-dd");
  const periodEnd = format(subDays(closingFriday, 1), "yyyy-MM-dd");

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores-fechamento-semanal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome, polo_id, ativo, percentual_repasse")
        .not("polo_id", "is", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Seleciona automaticamente o primeiro colaborador (prioriza "Felipe") assim que a lista carrega
  useMemo(() => {
    if (!colaboradorId && colaboradores && colaboradores.length > 0) {
      const felipe = colaboradores.find((c) => c.nome?.toLowerCase().includes("felipe"));
      setColaboradorId((felipe ?? colaboradores[0]).id);
    }
  }, [colaboradores, colaboradorId]);

  const colaboradorSelecionado = colaboradores?.find((c) => c.id === colaboradorId);

  useMemo(() => {
    if (colaboradorSelecionado) {
      setPercentualInput(String(Number(colaboradorSelecionado.percentual_repasse ?? 30)));
    }
  }, [colaboradorSelecionado?.id]);

  const { data: parcelas, isLoading } = useQuery({
    queryKey: ["fechamento-semanal", colaboradorSelecionado?.polo_id, periodStart, periodEnd],
    enabled: !!colaboradorSelecionado?.polo_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("id, valor, valor_liquido, forma_pagamento, tipo, data_pagamento, matriculas(alunos(nome, ctr))")
        .eq("status", "pago")
        .eq("polo_id", colaboradorSelecionado!.polo_id)
        .neq("tipo", "taxa_matricula")
        .gte("data_pagamento", periodStart)
        .lte("data_pagamento", periodEnd)
        .order("data_pagamento");
      if (error) throw error;
      return (data ?? []) as unknown as ParcelaFechamento[];
    },
  });

  const total = useMemo(() => {
    return (parcelas ?? []).reduce((acc, p) => {
      const isCartao = p.forma_pagamento === "cartao";
      const val = isCartao && p.valor_liquido ? Number(p.valor_liquido) : Number(p.valor);
      return acc + val;
    }, 0);
  }, [parcelas]);

  const percentualColaborador = Number(colaboradorSelecionado?.percentual_repasse ?? 30);
  const valorColaborador = total * (percentualColaborador / 100);
  const valorMatriz = total - valorColaborador;

  const { data: statusPagamento } = useQuery({
    queryKey: ["fechamento-semanal-status", colaboradorId, periodStart, periodEnd],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fechamentos_semanais_pagamentos")
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .eq("semana_inicio", periodStart)
        .eq("semana_fim", periodEnd)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [editandoPagamento, setEditandoPagamento] = useState(false);
  const [dataPagamentoInput, setDataPagamentoInput] = useState(format(new Date(), "yyyy-MM-dd"));

  const marcarComoPago = useMutation({
    mutationFn: async (dataPagamento: string) => {
      const { error } = await supabase
        .from("fechamentos_semanais_pagamentos")
        .upsert(
          {
            colaborador_id: colaboradorId,
            semana_inicio: periodStart,
            semana_fim: periodEnd,
            pago: true,
            data_pagamento: dataPagamento,
            valor_total: total,
            valor_matriz: valorMatriz,
            valor_colaborador: valorColaborador,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "colaborador_id,semana_inicio,semana_fim" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fechamento marcado como pago!");
      qc.invalidateQueries({ queryKey: ["fechamento-semanal-status", colaboradorId, periodStart, periodEnd] });
      setEditandoPagamento(false);
    },
    onError: (e: Error) => toast.error("Erro ao registrar pagamento", { description: e.message }),
  });

  const desmarcarPago = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fechamentos_semanais_pagamentos")
        .update({ pago: false, data_pagamento: null, updated_at: new Date().toISOString() })
        .eq("colaborador_id", colaboradorId)
        .eq("semana_inicio", periodStart)
        .eq("semana_fim", periodEnd);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcação de pagamento desfeita.");
      qc.invalidateQueries({ queryKey: ["fechamento-semanal-status", colaboradorId, periodStart, periodEnd] });
    },
    onError: (e: Error) => toast.error("Erro ao desfazer", { description: e.message }),
  });

  const salvarPercentual = useMutation({
    mutationFn: async (novoPercentual: number) => {
      if (!colaboradorSelecionado) return;
      const { error } = await supabase
        .from("colaboradores")
        .update({ percentual_repasse: novoPercentual })
        .eq("id", colaboradorSelecionado.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Percentual de repasse atualizado!");
      qc.invalidateQueries({ queryKey: ["colaboradores-fechamento-semanal"] });
      setEditandoPercentual(false);
    },
    onError: (e: Error) => toast.error("Erro ao salvar percentual", { description: e.message }),
  });

  const exportCSV = () => {
    const headers = ["Aluno", "CTR", "Forma de Pagamento", "Data do Pagamento", "Valor"];
    const rows = (parcelas ?? []).map((p) => {
      const isCartao = p.forma_pagamento === "cartao";
      const val = isCartao && p.valor_liquido ? Number(p.valor_liquido) : Number(p.valor);
      return [
        p.matriculas?.alunos?.nome ?? "—",
        String(p.matriculas?.alunos?.ctr ?? ""),
        p.forma_pagamento ?? "",
        p.data_pagamento ?? "",
        val.toFixed(2).replace(".", ","),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((f) => `"${f}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fechamento-semanal-${colaboradorSelecionado?.nome ?? ""}-${periodStart}-a-${periodEnd}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Fechamento Semanal
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                {(colaboradores ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}{!c.ativo ? " (inativo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setClosingFriday((d) => subDays(d, 7))} title="Semana anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
              {formatDate(periodStart)} a {formatDate(periodEnd)}
            </Badge>
            <Button variant="outline" size="icon" onClick={() => setClosingFriday((d) => addDays(d, 7))} title="Próxima semana">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Badge className="bg-emerald-600 hover:bg-emerald-600 whitespace-nowrap">
              Fecha em {formatDate(closingFriday)}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead>Data do Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!parcelas || parcelas.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum recebimento nesse período.
                    </TableCell>
                  </TableRow>
                )}
                {(parcelas ?? []).map((p) => {
                  const isCartao = p.forma_pagamento === "cartao";
                  const val = isCartao && p.valor_liquido ? Number(p.valor_liquido) : Number(p.valor);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.matriculas?.alunos?.nome ?? "—"}</TableCell>
                      <TableCell>{p.matriculas?.alunos?.ctr ?? "—"}</TableCell>
                      <TableCell className="capitalize">{p.forma_pagamento ?? "—"}</TableCell>
                      <TableCell>{p.data_pagamento ? formatDate(p.data_pagamento) : "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(val)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-4 mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={!parcelas || parcelas.length === 0}>
                  <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
                <div className="text-sm text-right">
                  <span className="text-muted-foreground">Total do fechamento (sem taxas): </span>
                  <strong className="text-lg text-green-700">{formatCurrency(total)}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    Matriz ({(100 - percentualColaborador).toFixed(0)}%)
                  </p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(valorMatriz)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {colaboradorSelecionado?.nome ?? "Colaborador"}
                      {!editandoPercentual && ` (${percentualColaborador.toFixed(0)}%)`}
                    </p>
                    {editandoPercentual ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="w-16 h-7 text-sm"
                          value={percentualInput}
                          onChange={(e) => setPercentualInput(e.target.value)}
                          min={0}
                          max={100}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={salvarPercentual.isPending}
                          onClick={() => salvarPercentual.mutate(Number(percentualInput))}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditandoPercentual(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(valorColaborador)}</p>
                </div>
              </div>

              <div className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${statusPagamento?.pago ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                {statusPagamento?.pago ? (
                  <>
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <CircleDollarSign className="h-5 w-5" />
                      Pago em {statusPagamento.data_pagamento ? formatDate(statusPagamento.data_pagamento) : "—"}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => desmarcarPago.mutate()}
                      disabled={desmarcarPago.isPending}
                    >
                      <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Desfazer
                    </Button>
                  </>
                ) : editandoPagamento ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-700">Data do pagamento:</span>
                      <Input
                        type="date"
                        className="w-40 h-8"
                        value={dataPagamentoInput}
                        onChange={(e) => setDataPagamentoInput(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditandoPagamento(false)}>Cancelar</Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={marcarComoPago.isPending || !dataPagamentoInput}
                        onClick={() => marcarComoPago.mutate(dataPagamentoInput)}
                      >
                        {marcarComoPago.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                        Confirmar
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-amber-700 text-sm">
                      <CircleDollarSign className="h-5 w-5" />
                      Esse fechamento ainda não foi marcado como pago
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        setDataPagamentoInput(format(new Date(), "yyyy-MM-dd"));
                        setEditandoPagamento(true);
                      }}
                    >
                      Marcar como pago
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
