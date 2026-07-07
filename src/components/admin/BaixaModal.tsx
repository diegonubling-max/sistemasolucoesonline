import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, CreditCard, Landmark, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";

interface BaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    data_pagamento: string;
    forma_pagamento: string;
    valor_pago: number;
    parcelas_cartao?: number;
    taxa_cartao?: number;
    valor_liquido?: number;
  }) => void;
  isLoading: boolean;
  valorOriginal: number;
  valorPagoAtual?: number;
}

const TAXAS_CARTAO: Record<number, number> = {
  1: 4.20, 2: 6.09, 3: 7.01, 4: 7.91, 5: 8.80, 6: 9.67,
  7: 12.59, 8: 13.42, 9: 14.25, 10: 15.06, 11: 15.87, 12: 16.66,
};

export function BaixaModal({ open, onOpenChange, onConfirm, isLoading, valorOriginal, valorPagoAtual = 0 }: BaixaModalProps) {
  const restanteInicial = Math.max(0, valorOriginal - valorPagoAtual);
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [parcelasCartao, setParcelasCartao] = useState<number>(1);
  const [dataPagamento, setDataPagamento] = useState<Date>(new Date());
  const [valorPago, setValorPago] = useState<number>(restanteInicial);

  useEffect(() => {
    if (open) {
      setEtapa(1);
      setFormaPagamento(null);
      setParcelasCartao(1);
      setDataPagamento(new Date());
      setValorPago(Math.max(0, valorOriginal - valorPagoAtual));
    }
  }, [open, valorOriginal, valorPagoAtual]);

  const handleSelectForma = (forma: string) => {
    setFormaPagamento(forma);
    setEtapa(forma === 'cartao' ? 2 : 3);
  };

  const saldoRestante = Math.max(0, restanteInicial - valorPago);
  const taxa = formaPagamento === 'cartao' ? TAXAS_CARTAO[parcelasCartao] : 0;
  const valorTaxa = (valorPago * taxa) / 100;
  const valorLiquido = valorPago - valorTaxa;
  const valorInvalido = valorPago <= 0 || valorPago > restanteInicial + 0.001;

  const handleConfirmar = () => {
    onConfirm({
      data_pagamento: format(dataPagamento, "yyyy-MM-dd"),
      forma_pagamento: formaPagamento!,
      valor_pago: valorPago,
      ...(formaPagamento === 'cartao' ? {
        parcelas_cartao: parcelasCartao,
        taxa_cartao: taxa,
        valor_liquido: valorLiquido
      } : {})
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {etapa === 1 && "Como o aluno efetuou o pagamento?"}
            {etapa === 2 && "Em quantas vezes o aluno pagou?"}
            {etapa === 3 && "Dados do pagamento"}
          </DialogTitle>
          <DialogDescription>
            {etapa === 1 && "Selecione a forma de pagamento utilizada."}
            {etapa === 2 && "Selecione o número de parcelas no cartão."}
            {etapa === 3 && "Informe o valor pago e a data do recebimento."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {etapa === 1 && (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleSelectForma('boleto')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all gap-2"
              >
                <Landmark className="h-8 w-8 text-blue-600" />
                <span className="text-xs font-bold text-center">Boleto / Depósito</span>
              </button>
              <button
                onClick={() => handleSelectForma('pix')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all gap-2"
              >
                <QrCode className="h-8 w-8 text-green-600" />
                <span className="text-xs font-bold text-center">PIX</span>
              </button>
              <button
                onClick={() => handleSelectForma('cartao')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all gap-2"
              >
                <CreditCard className="h-8 w-8 text-purple-600" />
                <span className="text-xs font-bold text-center">Cartão Infinity</span>
              </button>
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Select value={parcelasCartao.toString()} onValueChange={(v) => setParcelasCartao(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setEtapa(1)}>Voltar</Button>
                <Button onClick={() => setEtapa(3)}>Continuar</Button>
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor pago</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={restanteInicial}
                  value={valorPago}
                  onChange={(e) => setValorPago(Math.max(0, Number(e.target.value)))}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Saldo restante: <span className={cn("font-bold", saldoRestante > 0 ? "text-yellow-600" : "text-green-600")}>{formatCurrency(saldoRestante)}</span>
                  </span>
                  {valorPagoAtual > 0 && (
                    <span className="text-muted-foreground">Já pago: {formatCurrency(valorPagoAtual)}</span>
                  )}
                </div>
                {valorInvalido && (
                  <p className="text-xs text-red-600">Valor deve ser maior que 0 e menor ou igual ao restante.</p>
                )}
              </div>

              {formaPagamento === 'cartao' && (
                <div className="bg-muted/50 p-3 rounded-xl border border-dashed space-y-1 text-sm">
                  <div className="flex justify-between"><span>Parcelas:</span><span className="font-bold">{parcelasCartao}x</span></div>
                  <div className="flex justify-between text-red-600"><span>Taxa ({taxa}%):</span><span className="font-bold">- {formatCurrency(valorTaxa)}</span></div>
                  <div className="flex justify-between pt-1 border-t font-black text-primary"><span>Líquido:</span><span>{formatCurrency(valorLiquido)}</span></div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataPagamento && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataPagamento ? format(dataPagamento, "dd/MM/yyyy") : <span>Selecione a data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataPagamento} onSelect={(d) => d && setDataPagamento(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setEtapa(formaPagamento === 'cartao' ? 2 : 1)}>Voltar</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isLoading || valorInvalido}
                  onClick={handleConfirmar}
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar {saldoRestante > 0 ? "Pagamento Parcial" : "Baixa"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
