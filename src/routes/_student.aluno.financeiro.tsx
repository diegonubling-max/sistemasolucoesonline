import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  Receipt,
  CreditCard,
  Copy,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { generateAsaasCobrar } from "@/services/asaas";
import { useStudentTheme } from "./_student";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_student/aluno/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Soluções Online" }] }),
  component: StudentFinance,
});

function StudentFinance() {
  const { session } = useAuth();
  const { isDark } = useStudentTheme();
  const queryClient = useQueryClient();
  const [showPixDialog, setShowPixDialog] = useState<{ qrcode: string, key: string } | null>(null);

  const generatePaymentMutation = useMutation({
    mutationFn: async ({ parcela, type }: { parcela: any, type: 'PIX' | 'BOLETO' }) => {
      const response = await generateAsaasCobrar(parcela.id, type);

      if (response.error) {
        throw new Error(response.error);
      }

      return { 
        ...response.updateParcela, 
        type, 
        // Garantir campos para o modal/retorno
        identificationField: response.updateParcela.asaas_barcode,
        bankSlipUrl: response.updateParcela.asaas_url
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["student-finance"] });
      toast.success("Cobrança gerada com sucesso!");
      if (data.type === 'PIX' && data.asaas_pix_qrcode) {
        setShowPixDialog({ qrcode: data.asaas_pix_qrcode, key: data.asaas_pix_chave });
      }
    },
    onError: (error: any) => {
      toast.error(`Erro ao gerar cobrança: ${error.message}`);
    }
  });

  const { data: financeData, isLoading } = useQuery({
    queryKey: ["student-finance", session?.user.email],
    queryFn: async () => {
      // 1. Find student by email
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id, asaas_customer_id")
        .eq("email", session?.user.email ?? "")
        .single();
      
      if (!aluno) return null;

      // 2. Find enrollment
      const { data: matricula } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", aluno.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!matricula) return { parcelas: [] };

      // 3. Find installments
      const { data: parcelas, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("matricula_id", matricula.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return { parcelas: parcelas || [], aluno };
    },
    enabled: !!session?.user.email,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string, vencimento: string) => {
    if (status === 'pago') {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none flex items-center gap-1 w-fit">
          <CheckCircle2 className="h-3 w-3" /> Pago
        </Badge>
      );
    }
    if (status === 'isento') {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none w-fit">
          Isento
        </Badge>
      );
    }

    const isVencido = isBefore(new Date(vencimento), startOfDay(new Date()));
    if (isVencido) {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none w-fit">
          Vencido
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-none w-fit">
        Em aberto
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string | null, parcelasCartao?: number | null) => {
    if (!method) return null;
    
    if (method.toLowerCase().includes('cartão')) {
      const label = parcelasCartao ? `Cartão ${parcelasCartao}x` : 'Cartão';
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none">
          {label}
        </Badge>
      );
    }
    if (method.toLowerCase().includes('pix')) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
          PIX
        </Badge>
      );
    }
    if (method.toLowerCase().includes('boleto')) {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
          Boleto
        </Badge>
      );
    }
    return <span className="text-sm text-muted-foreground">{method}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const parcelas = financeData?.parcelas || [];
  
  const totalPago = parcelas
    .filter(p => p.status === 'pago')
    .reduce((acc, p) => acc + Number(p.valor), 0);
  
  const totalEmAberto = parcelas
    .filter(p => p.status === 'aberto')
    .reduce((acc, p) => acc + Number(p.valor), 0);
    
  const totalContrato = parcelas
    .filter(p => p.status !== 'isento')
    .reduce((acc, p) => acc + Number(p.valor), 0);

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Financeiro</h1>
        <p className="text-gray-500">Acompanhe suas mensalidades e histórico de pagamentos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border-gray-200 shadow-sm border p-6 rounded-xl relative overflow-hidden group transition-all">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-gray-500 font-medium">Total Pago</span>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-gray-900 relative z-10">{formatCurrency(totalPago)}</div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-green-500 transform translate-y-1 group-hover:translate-y-0 transition-transform" />
        </div>

        <div className="bg-white border-gray-200 shadow-sm border p-6 rounded-xl relative overflow-hidden group transition-all">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-gray-500 font-medium">Em Aberto</span>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-gray-900 relative z-10">{formatCurrency(totalEmAberto)}</div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-yellow-500 transform translate-y-1 group-hover:translate-y-0 transition-transform" />
        </div>

        <div className="bg-white border-gray-200 shadow-sm border p-6 rounded-xl relative overflow-hidden group transition-all">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-gray-500 font-medium">Total do Contrato</span>
            <div className="p-2 bg-[#2D6ADF]/10 rounded-lg">
              <Wallet className="h-5 w-5 text-[#2D6ADF]" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-gray-900 relative z-10">{formatCurrency(totalContrato)}</div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-[#2D6ADF] transform translate-y-1 group-hover:translate-y-0 transition-transform" />
        </div>
      </div>

      <div className="bg-white border-gray-200 shadow-md border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-[#2D6ADF]" />
            <h2 className="text-xl font-bold text-gray-900">Minhas Cobranças</h2>
          </div>
          
          {!financeData?.aluno?.asaas_customer_id && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-medium animate-in fade-in slide-in-from-right-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Sua conta de pagamento será configurada no primeiro pagamento.</span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableHead className="text-gray-500 font-bold">Descrição</TableHead>
                <TableHead className="text-gray-500 font-bold">Vencimento</TableHead>
                <TableHead className="text-gray-500 font-bold">Valor</TableHead>
                <TableHead className="text-gray-500 font-bold text-center">Status</TableHead>
                <TableHead className="text-gray-500 font-bold text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.length === 0 ? (
                <TableRow className="border-gray-100">
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                    Nenhuma cobrança encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                parcelas.map((parcela) => {
                  const status = parcela.status;
                  const isPago = status === 'pago';
                  
                  return (
                    <TableRow key={parcela.id} className="border-gray-100 hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium text-gray-900">
                        {parcela.descricao || (parcela.tipo === 'taxa_matricula' ? 'Taxa de Matrícula' : `Parcela ${parcela.numero}`)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {format(new Date(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-bold text-gray-900">
                        {formatCurrency(Number(parcela.valor))}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          {status === 'pago' ? (
                            <Badge className="bg-green-500/20 text-green-500 border-none">Pago</Badge>
                          ) : status === 'isento' ? (
                            <Badge className="bg-gray-100 text-gray-500 border-none">Isento</Badge>
                          ) : isBefore(new Date(parcela.data_vencimento), startOfDay(new Date())) ? (
                            <Badge className="bg-red-500/20 text-red-500 border-none">Vencido</Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-500 border-none">Em aberto</Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        {isPago ? (
                          <span className="text-xs text-green-500 font-medium">Pago via {parcela.forma_pagamento || 'N/A'}</span>
                        ) : status === 'isento' ? (
                          <span className="text-xs text-gray-500 italic">Isentado</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            {parcela.asaas_id ? (
                              <>
                                {parcela.asaas_pix_qrcode ? (
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 border-green-200 text-green-600 hover:bg-green-50"
                                      onClick={() => setShowPixDialog({ qrcode: parcela.asaas_pix_qrcode || "", key: parcela.asaas_pix_chave || "" })}
                                    >
                                      <CreditCard className="h-3 w-3 mr-1" /> Ver QR Code
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 border-green-200 text-green-600 hover:bg-green-50"
                                      onClick={() => {
                                        navigator.clipboard.writeText(parcela.asaas_pix_chave || "");
                                        toast.success("Chave PIX copiada!");
                                      }}
                                    >
                                      <Copy className="h-3 w-3 mr-1" /> Copiar PIX
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex flex-col gap-1 items-end">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                                        onClick={() => {
                                          if (parcela.asaas_url) {
                                            window.open(parcela.asaas_url, '_blank', 'noopener,noreferrer');
                                          }
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" /> Ver PDF do Boleto
                                      </Button>
                                      <a 
                                        href={parcela.asaas_url || "#"} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-[10px] text-blue-500 hover:underline"
                                      >
                                        Clique aqui se o PDF não abrir
                                      </a>
                                    </div>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 border-gray-200 text-gray-600 hover:bg-gray-50"
                                      onClick={() => {
                                        navigator.clipboard.writeText(parcela.asaas_barcode || "");
                                        toast.success("Código de barras copiado!");
                                      }}
                                    >
                                      <Copy className="h-3 w-3 mr-1" /> Copiar Código
                                    </Button>
                                  </>
                                )}
                              </>
                            ) : (
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 border-[#2D6ADF] text-[#2D6ADF] hover:bg-[#2D6ADF]/5"
                                  onClick={() => generatePaymentMutation.mutate({ parcela, type: 'PIX' })}
                                  disabled={generatePaymentMutation.isPending}
                                >
                                  {generatePaymentMutation.isPending && generatePaymentMutation.variables?.type === 'PIX' && generatePaymentMutation.variables?.parcela.id === parcela.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <CreditCard className="h-3 w-3 mr-1" />
                                  )}
                                  Gerar PIX
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 border-[#2D6ADF] text-[#2D6ADF] hover:bg-[#2D6ADF]/5"
                                  onClick={() => generatePaymentMutation.mutate({ parcela, type: 'BOLETO' })}
                                  disabled={generatePaymentMutation.isPending}
                                >
                                  {generatePaymentMutation.isPending && generatePaymentMutation.variables?.type === 'BOLETO' && generatePaymentMutation.variables?.parcela.id === parcela.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Receipt className="h-3 w-3 mr-1" />
                                  )}
                                  Gerar Boleto
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!showPixDialog} onOpenChange={(open) => !open && setShowPixDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo ou copie a chave PIX para pagar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            {showPixDialog?.qrcode && (
              <div className="bg-white p-4 rounded-xl border">
                <img 
                  src={`data:image/png;base64,${showPixDialog.qrcode}`} 
                  alt="QR Code PIX" 
                  className="w-48 h-48"
                />
              </div>
            )}
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                navigator.clipboard.writeText(showPixDialog?.key || "");
                toast.success("Chave PIX copiada!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Copiar Código PIX
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
