import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, AlertOctagon } from "lucide-react";

interface Props {
  alunoId: string | null;
  nomeAluno: string;
}

type Nivel = "nivel1" | "nivel2" | null;

export function InadimplenciaAlerts({ alunoId, nomeAluno }: Props) {
  const navigate = useNavigate();
  const [nivel, setNivel] = useState<Nivel>(null);
  const [diasAtraso, setDiasAtraso] = useState(0);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!alunoId) return;

    (async () => {
      const { data: matriculas } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", alunoId);

      const matriculaIds = (matriculas ?? []).map((m) => m.id);
      if (matriculaIds.length === 0) return;

      const hoje = new Date();
      const hojeStr = hoje.toISOString().slice(0, 10);

      const { data: parcelas } = await supabase
        .from("parcelas")
        .select("data_vencimento, status")
        .in("matricula_id", matriculaIds)
        .eq("status", "aberto")
        .lt("data_vencimento", hojeStr);

      if (!parcelas || parcelas.length === 0) return;

      let maxDias = 0;
      for (const p of parcelas) {
        const venc = new Date(p.data_vencimento + "T00:00:00");
        const dias = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
        if (dias > maxDias) maxDias = dias;
      }

      setDiasAtraso(maxDias);

      let nv: Nivel = null;
      if (maxDias > 30) nv = "nivel2";
      else if (maxDias >= 3) nv = "nivel1";

      if (!nv) return;
      setNivel(nv);

      const chave = `inadimplencia_popup_${alunoId}_${nv}`;
      const ultimaData = localStorage.getItem(chave);
      if (ultimaData !== hojeStr) {
        setShowPopup(true);
        localStorage.setItem(chave, hojeStr);
      }
    })();
  }, [alunoId]);

  if (!nivel) return null;

  const irFinanceiro = () => {
    setShowPopup(false);
    navigate({ to: "/aluno/financeiro" });
  };

  const isNivel2 = nivel === "nivel2";
  const mensagem = isNivel2
    ? `🚨 Atenção ${nomeAluno}! Sua parcela está há mais de 30 dias em atraso. Para não perder o acesso à plataforma e continuar rumo à sua formação, regularize agora!`
    : "⚠️ Você tem uma parcela em aberto. Não deixe isso interromper sua jornada — seu futuro está sendo construído aqui! Regularize e continue seus estudos.";
  const botaoLabel = isNivel2 ? "Regularizar agora" : "Ver parcela em aberto";

  return (
    <>
      <div
        className={`w-full px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between ${
          isNivel2
            ? "bg-red-600 text-white"
            : "bg-amber-400 text-amber-950"
        }`}
      >
        <div className="flex items-start gap-2 flex-1">
          {isNivel2 ? (
            <AlertOctagon className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <p className="text-sm sm:text-base font-medium">{mensagem}</p>
        </div>
        <Button
          onClick={irFinanceiro}
          className={`shrink-0 ${
            isNivel2
              ? "bg-white text-red-700 hover:bg-white/90"
              : "bg-amber-950 text-white hover:bg-amber-900"
          }`}
        >
          {botaoLabel}
        </Button>
      </div>

      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isNivel2 ? (
                <AlertOctagon className="h-6 w-6 text-red-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              )}
              {isNivel2 ? "Parcela em atraso há mais de 30 dias" : "Parcela em aberto"}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {mensagem}
              {isNivel2 && (
                <span className="block mt-3 text-sm text-muted-foreground">
                  Após regularizar seu acesso será mantido normalmente.
                </span>
              )}
              <span className="block mt-3 text-xs text-muted-foreground">
                Dias em atraso: {diasAtraso}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={irFinanceiro} className={isNivel2 ? "bg-red-600 hover:bg-red-700" : ""}>
              {botaoLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
