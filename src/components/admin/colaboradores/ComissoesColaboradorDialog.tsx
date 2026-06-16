import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendedora: string | null;
}

export function ComissoesColaboradorDialog({ open, onOpenChange, vendedora }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["comissoes-colaborador", vendedora],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("*")
        .eq("vendedora", vendedora!)
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!vendedora && open,
  });

  const resumo = useMemo(() => {
    const meses = new Map<string, { competencia: string; gerado: number; pago: number; estornos: number; aReceber: number }>();
    for (const c of data ?? []) {
      const k = c.competencia as string;
      const r = meses.get(k) ?? { competencia: k, gerado: 0, pago: 0, estornos: 0, aReceber: 0 };
      if (!c.estornado) {
        r.gerado += Number(c.valor);
        if (c.status === "pago") r.pago += Number(c.valor);
        else r.aReceber += Number(c.valor);
      }
      meses.set(k, r);
      // Estornos lançados no mês do estorno
      if (c.estornado && c.estorno_competencia) {
        const ek = c.estorno_competencia as string;
        const er = meses.get(ek) ?? { competencia: ek, gerado: 0, pago: 0, estornos: 0, aReceber: 0 };
        er.estornos += Number(c.valor);
        meses.set(ek, er);
      }
    }
    return Array.from(meses.values()).sort((a, b) => b.competencia.localeCompare(a.competencia));
  }, [data]);

  const totais = useMemo(() => {
    const t = { pago: 0, aReceber: 0, estornos: 0 };
    for (const r of resumo) {
      t.pago += r.pago;
      t.aReceber += r.aReceber;
      t.estornos += r.estornos;
    }
    return t;
  }, [resumo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Comissões — {vendedora}</DialogTitle>
          <DialogDescription>Histórico por competência</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total recebido</p><p className="text-xl font-bold text-green-600">{formatCurrency(totais.pago)}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">A receber</p><p className="text-xl font-bold text-yellow-600">{formatCurrency(totais.aReceber)}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Estornos</p><p className="text-xl font-bold text-red-600">{formatCurrency(totais.estornos)}</p></CardContent></Card>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Gerado</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">A receber</TableHead>
                  <TableHead className="text-right">Estornos</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem comissões registradas.</TableCell></TableRow>
                )}
                {resumo.map((r) => {
                  const liquido = r.gerado - r.estornos;
                  return (
                    <TableRow key={r.competencia}>
                      <TableCell className="font-medium">{format(new Date(r.competencia), "MM/yyyy")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.gerado)}</TableCell>
                      <TableCell className="text-right text-green-700">{formatCurrency(r.pago)}</TableCell>
                      <TableCell className="text-right text-yellow-700">{formatCurrency(r.aReceber)}</TableCell>
                      <TableCell className="text-right text-red-600">{r.estornos > 0 ? `- ${formatCurrency(r.estornos)}` : "—"}</TableCell>
                      <TableCell>
                        {r.aReceber === 0 && liquido > 0 ? (
                          <Badge className="bg-green-500 hover:bg-green-500">Pago</Badge>
                        ) : (
                          <Badge className="bg-yellow-500 hover:bg-yellow-500">A pagar</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
