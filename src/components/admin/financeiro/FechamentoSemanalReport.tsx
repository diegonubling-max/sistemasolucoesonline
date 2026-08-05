import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, FileDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { format, addDays, subDays } from "date-fns";

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
  const [closingFriday, setClosingFriday] = useState<Date>(() => getClosingFriday(new Date()));
  const [colaboradorId, setColaboradorId] = useState<string>("");

  const periodStart = format(subDays(closingFriday, 7), "yyyy-MM-dd");
  const periodEnd = format(subDays(closingFriday, 1), "yyyy-MM-dd");

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores-fechamento-semanal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome, polo_id, ativo")
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

            <div className="flex flex-col md:flex-row md:items-center justify-between mt-6 pt-4 border-t gap-4">
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!parcelas || parcelas.length === 0}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
              <div className="text-sm">
                <span className="text-muted-foreground">Total do fechamento (sem taxas): </span>
                <strong className="text-lg text-green-700">{formatCurrency(total)}</strong>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
