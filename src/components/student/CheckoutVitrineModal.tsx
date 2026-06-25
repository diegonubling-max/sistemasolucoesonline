import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, Check, Lock, QrCode, CreditCard, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Vitrine = {
  id: string;
  preco_pix: number;
  preco_cartao: number;
  preco_normal?: number | null;
  preco_com_pontos?: number | null;
  pontos_necessarios?: number | null;
  max_parcelas: number;
  cursos?: { nome: string; thumbnail_url?: string | null };
};

export function CheckoutVitrineModal({
  vitrine,
  open,
  onClose,
  onSuccess,
}: {
  vitrine: Vitrine | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<"pix" | "cartao">("pix");
  const [loading, setLoading] = useState(false);
  const [compraId, setCompraId] = useState<string | null>(null);
  const [pix, setPix] = useState<{ payload: string; encodedImage: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(30 * 60);
  const parcelas = 12;
  const [cartao, setCartao] = useState({ holderName: "", number: "", expiry: "", ccv: "" });

  useEffect(() => {
    if (!open) {
      setPix(null);
      setCompraId(null);
      setSeconds(30 * 60);
      setTab("pix");
      
      setCartao({ holderName: "", number: "", expiry: "", ccv: "" });
    }
  }, [open]);

  useEffect(() => {
    if (!pix) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [pix]);

  if (!vitrine) return null;
  const baseCartao = Number(vitrine.preco_com_pontos ?? vitrine.preco_normal ?? vitrine.preco_pix);
  const valorParcelaCartao = baseCartao / 10;
  const totalCartao = valorParcelaCartao * 12;
  const total = tab === "pix" ? Number(vitrine.preco_pix) : totalCartao;
  const maxParc = 12;

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const gerarPix = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-vitrine-checkout", {
        body: { vitrine_id: vitrine.id, forma_pagamento: "pix" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setCompraId(data.compra_id);
      setPix(data.pix);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const pagarCartao = async () => {
    const [mm, yy] = cartao.expiry.split("/");
    if (!cartao.holderName || !cartao.number || !mm || !yy || !cartao.ccv) {
      return toast.error("Preencha todos os dados do cartão");
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-vitrine-checkout", {
        body: {
          vitrine_id: vitrine.id,
          forma_pagamento: "cartao",
          parcelas,
          cartao: {
            holderName: cartao.holderName,
            number: cartao.number,
            expiryMonth: mm.trim(),
            expiryYear: yy.trim().length === 2 ? `20${yy.trim()}` : yy.trim(),
            ccv: cartao.ccv,
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
        toast.success("Pagamento aprovado!");
        onSuccess();
        onClose();
      } else {
        toast.info("Pagamento em análise. Você será notificado.");
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro no pagamento");
    } finally {
      setLoading(false);
    }
  };

  const jaPaguei = async () => {
    if (!compraId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-vitrine-status", { body: { compra_id: compraId } });
      if (error) throw error;
      if (data.status === "pago") {
        toast.success("Pagamento confirmado!");
        onSuccess();
        onClose();
      } else {
        toast.info("Ainda não recebemos o pagamento. Tente em instantes.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copiar = async () => {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-[#1E3A5F]" /> Finalizar compra
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-3 items-center bg-gray-50 rounded-xl p-3 border">
          {vitrine.cursos?.thumbnail_url ? (
            <img src={vitrine.cursos.thumbnail_url} className="h-16 w-16 rounded object-cover" />
          ) : (
            <div className="h-16 w-16 rounded bg-[#1E3A5F]" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{vitrine.cursos?.nome}</p>
            {vitrine.preco_normal && vitrine.preco_normal > total && (
              <p className="text-xs text-gray-400 line-through">{formatCurrency(vitrine.preco_normal)}</p>
            )}
            <p className="text-lg font-extrabold text-[#1E3A5F]">{formatCurrency(total)}</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="pix"><QrCode className="h-4 w-4 mr-2" />PIX</TabsTrigger>
            <TabsTrigger value="cartao"><CreditCard className="h-4 w-4 mr-2" />Cartão</TabsTrigger>
          </TabsList>

          <TabsContent value="pix" className="space-y-3 pt-4">
            {!pix ? (
              <Button className="w-full bg-green-600 hover:bg-green-700" disabled={loading} onClick={gerarPix}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                Gerar PIX — {formatCurrency(total)}
              </Button>
            ) : (
              <div className="space-y-3 text-center">
                <img
                  src={`data:image/png;base64,${pix.encodedImage}`}
                  alt="QR Code PIX"
                  className="mx-auto h-56 w-56 border rounded-lg"
                />
                <div>
                  <Label className="text-xs">Copia e cola</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={pix.payload} className="text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={copiar}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-mono text-orange-600">⏱ Expira em {formatTime(seconds)}</div>
                <p className="text-xs text-gray-500">Após o pagamento, seu acesso será liberado automaticamente.</p>
                <Button className="w-full" disabled={loading} onClick={jaPaguei}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Já paguei
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cartao" className="space-y-3 pt-4">
            <div className="rounded-xl border-2 border-[#1E3A5F]/20 bg-gradient-to-br from-blue-50 to-white p-4 text-center">
              <p className="text-xs text-gray-500 font-medium">{parcelas}x</p>
              <p className="text-3xl font-extrabold text-[#1E3A5F] leading-tight">
                {formatCurrency(total / parcelas)}
              </p>
              <p className="text-xs text-gray-500 font-medium">no cartão</p>
              <p className="text-xs text-gray-500 mt-1">Total: {formatCurrency(total)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="h-4 w-4 text-green-600" /> Pagamento seguro via Asaas
            </div>
            <div>
              <Label>Nome no cartão</Label>
              <Input value={cartao.holderName} onChange={(e) => setCartao({ ...cartao, holderName: e.target.value })} />
            </div>
            <div>
              <Label>Número do cartão</Label>
              <Input
                inputMode="numeric"
                maxLength={19}
                value={cartao.number}
                onChange={(e) => setCartao({ ...cartao, number: e.target.value.replace(/[^\d ]/g, "") })}
                placeholder="0000 0000 0000 0000"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Validade (MM/AA)</Label>
                <Input
                  maxLength={5}
                  value={cartao.expiry}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                    setCartao({ ...cartao, expiry: v });
                  }}
                  placeholder="MM/AA"
                />
              </div>
              <div>
                <Label>CVV</Label>
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  value={cartao.ccv}
                  onChange={(e) => setCartao({ ...cartao, ccv: e.target.value.replace(/\D/g, "") })}
                />
              </div>
            </div>
            <Button className="w-full bg-[#1E3A5F]" disabled={loading} onClick={pagarCartao}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Pagar {formatCurrency(total)}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
