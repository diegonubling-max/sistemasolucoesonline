import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PERGUNTAS, calcularPontuacao } from "@/lib/perfil-vocacional";

interface Props {
  alunoId: string;
  open: boolean;
  onClose: () => void;
}

export function PerfilVocacionalModal({ alunoId, open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<{ perfil: string } | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setRespostas({});
      setResultado(null);
    }
  }, [open]);

  const total = PERGUNTAS.length;
  const pergunta = PERGUNTAS[step];
  const progress = ((step + (resultado ? 1 : 0)) / total) * 100;

  async function handleSelect(opcaoId: string) {
    const novas = { ...respostas, [pergunta.id]: opcaoId };
    setRespostas(novas);

    if (step < total - 1) {
      setStep(step + 1);
      return;
    }

    // Última pergunta — calcular e salvar
    setSaving(true);
    try {
      const { perfil, topSegmentos } = calcularPontuacao(novas);
      const { error } = await supabase.from("aluno_perfil_vocacional").upsert(
        {
          aluno_id: alunoId,
          respostas: novas,
          perfil_identificado: perfil,
          segmentos_recomendados: topSegmentos,
        },
        { onConflict: "aluno_id" }
      );
      if (error) throw error;
      setResultado({ perfil });
    } catch (err: any) {
      toast.error("Erro ao salvar respostas: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resultado && onClose()}>
      <DialogContent
        className="max-w-lg bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border-0 shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {!resultado ? (
          <div className="space-y-6 py-2">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Descubra seu Potencial ✨</h2>
              <p className="text-sm text-white/70">
                Responda 6 perguntas rápidas e veja quais cursos foram feitos para você!
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/60">
                <span>Pergunta {step + 1} de {total}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/10" />
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{pergunta.texto}</h3>
              <div className="space-y-2">
                {pergunta.opcoes.map((o) => (
                  <button
                    key={o.id}
                    disabled={saving}
                    onClick={() => handleSelect(o.id)}
                    className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#2D6ADF] transition-all disabled:opacity-50 flex items-center gap-3"
                  >
                    {o.emoji && <span className="text-xl">{o.emoji}</span>}
                    <span className="text-sm">{o.label}</span>
                  </button>
                ))}
              </div>
              {saving && (
                <div className="flex items-center justify-center gap-2 text-sm text-white/60 pt-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Calculando seu perfil...
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg mx-auto">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-widest text-white/60">Seu perfil é</p>
              <h2 className="text-3xl font-bold">{resultado.perfil}</h2>
            </div>
            <p className="text-white/80 leading-relaxed">
              Com base nas suas respostas, identificamos os melhores cursos para acelerar sua
              carreira. Em breve seu tutor vai liberar o conteúdo ideal para você!
            </p>
            <Button
              size="lg"
              onClick={onClose}
              className="bg-gradient-to-r from-[#2D6ADF] to-[#1E3A5F] hover:opacity-90 w-full"
            >
              Começar meus estudos!
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
