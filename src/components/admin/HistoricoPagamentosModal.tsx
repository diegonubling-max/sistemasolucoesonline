import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";

interface Props {
  parcelaId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function HistoricoPagamentosModal({ parcelaId, onOpenChange }: Props) {
  const { data } = useQuery({
    queryKey: ["parcela-pagamentos", parcelaId],
    queryFn: async () => {
      if (!parcelaId) return [];
      const { data, error } = await supabase
        .from("parcelas_pagamentos")
        .select("id, valor_pago, data_pagamento, forma_pagamento, observacao")
        .eq("parcela_id", parcelaId)
        .order("data_pagamento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!parcelaId,
  });

  const total = (data ?? []).reduce((acc, p) => acc + Number(p.valor_pago), 0);
  const formaLabel = (f: string | null) =>
    f === "pix" ? "PIX" : f === "boleto" ? "Boleto" : f === "cartao" ? "Cartão" : "—";

  return (
    <Dialog open={!!parcelaId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Histórico de pagamentos</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {data && data.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Data</th>
                  <th className="py-2">Valor pago</th>
                  <th className="py-2">Forma</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{formatDate(p.data_pagamento)}</td>
                    <td className="py-2 font-bold">{formatCurrency(p.valor_pago)}</td>
                    <td className="py-2">{formaLabel(p.forma_pagamento)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 font-bold text-primary">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
