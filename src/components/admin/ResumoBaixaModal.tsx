import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

interface ResumoBaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    formaPagamento: string;
    parcelas?: number;
    valorBruto: number;
    taxa?: number;
    valorLiquido: number;
    dataPagamento: string;
  } | null;
}

export function ResumoBaixaModal({ open, onOpenChange, data }: ResumoBaixaModalProps) {
  if (!data) return null;

  const isCartao = data.formaPagamento === 'cartao';
  const valorTaxa = (data.valorBruto * (data.taxa || 0)) / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <DialogTitle className="text-xl font-bold text-green-700">Baixa realizada com sucesso!</DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="flex justify-between text-sm border-b pb-2">
            <span className="text-muted-foreground">Forma:</span>
            <span className="font-bold capitalize">{data.formaPagamento === 'cartao' ? 'Cartão Infinity' : data.formaPagamento}</span>
          </div>
          
          {isCartao && (
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-muted-foreground">Parcelas:</span>
              <span className="font-bold">{data.parcelas}x</span>
            </div>
          )}

          <div className="flex justify-between text-sm border-b pb-2">
            <span className="text-muted-foreground">Valor bruto:</span>
            <span className="font-bold">{formatCurrency(data.valorBruto)}</span>
          </div>

          {isCartao && (
            <div className="flex justify-between text-sm border-b pb-2 text-red-600">
              <span className="text-muted-foreground text-red-600">Taxa Infinity ({data.taxa}%):</span>
              <span className="font-bold">- {formatCurrency(valorTaxa)}</span>
            </div>
          )}

          <div className="flex justify-between text-base font-black text-green-700 border-b pb-2">
            <span>Valor líquido:</span>
            <span>{formatCurrency(data.valorLiquido)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Data do pagamento:</span>
            <span className="font-bold">{formatDate(data.dataPagamento)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
