import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateAsaasCobrar, asaasRequest } from "@/services/asaas";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alunoId: string;
  poloId: string | null;
  parcelas: any[] | undefined;
}

export function TrocarPacoteModal({ open, onOpenChange, alunoId, poloId, parcelas }: Props) {
  const qc = useQueryClient();
  const [selectedPacoteId, setSelectedPacoteId] = useState<string>("");
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const { data: pacotes } = useQuery({
    queryKey: ["pacotes-ativos-troca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacotes")
        .select("*")
        .eq("ativo", true)
        .order("tipo")
        .order("valor_total");
      if (error) throw error;
      return data ?? [];
    },
  });

  const abertas = useMemo(
    () => (parcelas ?? []).filter((p) => p.status === "aberto" && p.tipo === "parcela"),
    [parcelas]
  );

  const pacoteAtualNome = useMemo(() => {
    const first = (parcelas ?? []).find((p) => p.tipo_pacote);
    return first?.tipo_pacote || "—";
  }, [parcelas]);

  const novoPacote = pacotes?.find((p) => p.id === selectedPacoteId);

  const trocar = useMutation({
    mutationFn: async () => {
      if (!novoPacote) throw new Error("Selecione um pacote");

      // 1) Buscar a matrícula
      const { data: matriculas, error: mErr } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (mErr) throw mErr;
      const matriculaId = matriculas?.[0]?.id;
      if (!matriculaId) throw new Error("Matrícula não encontrada");

      // 2) Cancelar cobranças no Asaas e deletar parcelas abertas
      for (const p of abertas) {
        if (p.asaas_id) {
          try {
            await asaasRequest(`/payments/${p.asaas_id}`, { method: "DELETE" });
          } catch (err) {
            console.error("Falha ao cancelar Asaas:", p.asaas_id, err);
          }
        }
      }
      const ids = abertas.map((p) => p.id);
      if (ids.length > 0) {
        const { error: dErr } = await supabase.from("parcelas").delete().in("id", ids);
        if (dErr) throw dErr;
      }

      // 3) Calcular data base do vencimento
      const primeiroAberto = abertas[0];
      const base = primeiroAberto?.data_vencimento
        ? new Date(primeiroAberto.data_vencimento + "T00:00:00")
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            return d;
          })();

      // 4) Gerar novas parcelas
      const novas: any[] = [];
      const isCartao = novoPacote.tipo === "cartao";
      for (let i = 0; i < novoPacote.numero_parcelas; i++) {
        const venc = new Date(base);
        venc.setMonth(base.getMonth() + i);
        novas.push({
          matricula_id: matriculaId,
          polo_id: poloId,
          tipo: "parcela",
          numero: i + 1,
          valor: novoPacote.valor_parcela,
          data_vencimento: venc.toISOString().slice(0, 10),
          status: "aberto",
          descricao: `Parcela ${i + 1}/${novoPacote.numero_parcelas}`,
          tipo_pacote: novoPacote.nome,
          forma_pagamento: isCartao ? "cartao" : "boleto",
          cartao_parcelas: isCartao ? novoPacote.numero_parcelas : null,
        });
      }

      const { data: inserted, error: iErr } = await supabase
        .from("parcelas")
        .insert(novas)
        .select("id");
      if (iErr) throw iErr;

      // 5) Vincular pacote na matricula_pacotes (substituir vínculos antigos)
      await supabase.from("matricula_pacotes").delete().eq("matricula_id", matriculaId);
      await supabase.from("matricula_pacotes").insert({
        matricula_id: matriculaId,
        pacote_id: novoPacote.id,
      });

      // 6) Gerar cobranças no Asaas
      const asaasTipo: "PIX" | "BOLETO" = novoPacote.tipo === "pix" ? "PIX" : "BOLETO";
      if (inserted && !isCartao) {
        setProgress({ current: 0, total: inserted.length });
        let c = 0;
        for (const p of inserted) {
          c++;
          setProgress({ current: c, total: inserted.length });
          try {
            await generateAsaasCobrar(p.id, asaasTipo);
          } catch (err) {
            console.error("Erro ao gerar cobrança Asaas:", p.id, err);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Pacote atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["aluno-parcelas", alunoId] });
      setProgress(null);
      setStep("select");
      setSelectedPacoteId("");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error(e.message || "Erro ao trocar pacote");
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { boleto: [], cartao: [], pix: [] };
    (pacotes ?? []).forEach((p) => {
      if (g[p.tipo]) g[p.tipo].push(p);
    });
    return g;
  }, [pacotes]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!trocar.isPending) {
          onOpenChange(o);
          if (!o) {
            setStep("select");
            setSelectedPacoteId("");
          }
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trocar Pacote</DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Selecione o novo pacote. As parcelas em aberto serão substituídas."
              : "Confirme a troca de pacote."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Pacote atual</Label>
              <p className="text-sm font-medium">{pacoteAtualNome}</p>
            </div>
            <div>
              <Label>Novo pacote</Label>
              <Select value={selectedPacoteId} onValueChange={setSelectedPacoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pacote" />
                </SelectTrigger>
                <SelectContent>
                  {(["boleto", "cartao", "pix"] as const).map((tipo) =>
                    grouped[tipo]?.length ? (
                      <div key={tipo}>
                        <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                          {tipo}
                        </div>
                        {grouped[tipo].map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} — {formatCurrency(p.valor_total)}
                          </SelectItem>
                        ))}
                      </div>
                    ) : null
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {abertas.length} parcela(s) em aberto serão deletadas. Parcelas pagas serão preservadas.
              </span>
            </div>
          </div>
        )}

        {step === "confirm" && novoPacote && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Pacote atual</Label>
                <p className="font-medium">{pacoteAtualNome}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Novo pacote</Label>
                <p className="font-medium">{novoPacote.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {novoPacote.numero_parcelas}x {formatCurrency(novoPacote.valor_parcela)}
                </p>
              </div>
            </div>
            <div className="rounded-md bg-yellow-50 p-3 text-yellow-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                As parcelas em aberto serão deletadas e novas cobranças geradas no Asaas. Parcelas pagas não serão alteradas.
              </span>
            </div>
            {progress && (
              <p className="text-xs text-muted-foreground">
                Gerando cobranças: {progress.current}/{progress.total}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!selectedPacoteId} onClick={() => setStep("confirm")}>
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={trocar.isPending}
                onClick={() => setStep("select")}
              >
                Voltar
              </Button>
              <Button disabled={trocar.isPending} onClick={() => trocar.mutate()}>
                {trocar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar troca
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
