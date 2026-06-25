import { useEffect, useState, useCallback } from "react";
import { Star, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { calcNivel, type MilhasGanhouEvent } from "@/lib/milhas-eja";

interface SaldoMilhas {
  pontos_total: number;
  pontos_disponiveis: number;
  nivel: string;
}

interface HistoricoItem {
  id: string;
  pontos: number;
  tipo: string;
  descricao: string | null;
  created_at: string;
}

const NIVEIS = [
  { nome: "🌱 Iniciante", min: 0, max: 450 },
  { nome: "📚 Estudante", min: 451, max: 700 },
  { nome: "⭐ Dedicado", min: 701, max: 1200 },
  { nome: "🏆 Destaque", min: 1201, max: Infinity },
];

const COMO_GANHAR = [
  { icon: "✅", desc: "Primeiro login", pts: "+50 pts" },
  { icon: "📺", desc: "Assistir 1 aula (70%+)", pts: "+30 pts" },
  { icon: "🔥", desc: "3 aulas no mesmo dia", pts: "+100 pts" },
  { icon: "🎓", desc: "Completar todas as aulas de uma matéria", pts: "+450 pts" },
  { icon: "📅", desc: "7 dias seguidos de login", pts: "+150 pts" },
  { icon: "👥", desc: "Indicar 1-2 amigos matriculados", pts: "+150 pts" },
  { icon: "👥", desc: "Indicar 3-4 amigos", pts: "+250 pts" },
  { icon: "👥", desc: "Indicar 5+ amigos", pts: "+300 pts" },
];

const MENSAGENS_POPUP: Record<string, string> = {
  assistiu_aula: "Muito bem! Continue estudando! 🎯",
  bonus_3_aulas: "Incrível! 3 aulas hoje! 🔥",
  completou_materia: "Parabéns! Matéria concluída! 🎓",
  primeiro_login: "Bem-vindo à sua jornada! 🚀",
  "7_dias_login": "7 dias consecutivos! Você é incrível! 💪",
};

function proximoNivel(pontos: number) {
  const atual = NIVEIS.find((n) => pontos >= n.min && pontos <= n.max) ?? NIVEIS[0];
  const idx = NIVEIS.indexOf(atual);
  const prox = NIVEIS[idx + 1];
  if (!prox) return { faltam: 0, pct: 100, nome: atual.nome };
  const faltam = prox.min - pontos;
  const range = prox.min - atual.min;
  const pct = Math.max(0, Math.min(100, ((pontos - atual.min) / range) * 100));
  return { faltam, pct, nome: prox.nome };
}

export function MilhasEjaBadge({ alunoId }: { alunoId: string }) {
  const [saldo, setSaldo] = useState<SaldoMilhas | null>(null);
  const [open, setOpen] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("milhas_eja")
      .select("pontos_total, pontos_disponiveis, nivel")
      .eq("aluno_id", alunoId)
      .maybeSingle();
    if (data) setSaldo(data as SaldoMilhas);
    else setSaldo({ pontos_total: 0, pontos_disponiveis: 0, nivel: calcNivel(0) });
  }, [alunoId]);

  useEffect(() => {
    void carregar();
    const onGanhou = () => void carregar();
    window.addEventListener("milhas:ganhou", onGanhou);
    return () => window.removeEventListener("milhas:ganhou", onGanhou);
  }, [carregar]);

  if (!saldo) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
        title="Ver Milhas EJA"
      >
        <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
        <span className="text-sm font-semibold">{saldo.pontos_disponiveis} pts</span>
        <span className="hidden sm:inline text-xs opacity-80 border-l border-white/30 pl-2 ml-1">
          {saldo.nivel}
        </span>
      </button>
      <MilhasEjaModal alunoId={alunoId} open={open} onClose={() => setOpen(false)} saldo={saldo} />
    </>
  );
}

function MilhasEjaModal({
  alunoId,
  open,
  onClose,
  saldo,
}: {
  alunoId: string;
  open: boolean;
  onClose: () => void;
  saldo: SaldoMilhas;
}) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const prox = proximoNivel(saldo.pontos_total);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("milhas_eja_historico")
      .select("id, pontos, tipo, descricao, created_at")
      .eq("aluno_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setHistorico((data as HistoricoItem[]) ?? []));
  }, [alunoId, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" /> Milhas EJA
          </DialogTitle>
          <DialogDescription>Sua jornada de estudos em pontos</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo */}
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-5 text-center border">
            <div className="text-sm text-gray-600 mb-1">Nível atual</div>
            <div className="text-xl font-bold mb-3">{saldo.nivel}</div>
            <div className="text-4xl font-extrabold text-blue-600">{saldo.pontos_disponiveis}</div>
            <div className="text-xs text-gray-500 mt-1">pontos disponíveis</div>
            <div className="text-xs text-gray-500 mt-1">Total acumulado: {saldo.pontos_total} pts</div>
            {prox.faltam > 0 ? (
              <div className="mt-4 text-left">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Próximo: {prox.nome}</span>
                  <span>Faltam {prox.faltam} pts</span>
                </div>
                <Progress value={prox.pct} className="h-2" />
              </div>
            ) : (
              <div className="mt-4 text-sm font-semibold text-green-600">Nível máximo atingido! 🎉</div>
            )}
          </div>

          {/* Como ganhar */}
          <div>
            <h3 className="font-semibold mb-2">Como ganhar pontos</h3>
            <div className="space-y-1.5 text-sm">
              {COMO_GANHAR.map((c) => (
                <div key={c.desc} className="flex items-center justify-between border-b py-1.5">
                  <span>
                    <span className="mr-2">{c.icon}</span>
                    {c.desc}
                  </span>
                  <span className="font-semibold text-blue-600 whitespace-nowrap">{c.pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico */}
          <div>
            <h3 className="font-semibold mb-2">Histórico recente</h3>
            {historico.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">Nenhum lançamento ainda.</div>
            ) : (
              <div className="space-y-1.5 text-sm">
                {historico.map((h) => (
                  <div key={h.id} className="flex items-center justify-between border-b py-1.5">
                    <div className="min-w-0 pr-2">
                      <div className="truncate">{h.descricao ?? h.tipo}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(h.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <span
                      className={`font-semibold whitespace-nowrap ${
                        h.pontos >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {h.pontos >= 0 ? "+" : ""}
                      {h.pontos} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Provider/listener that shows popup + level-up modal on point events */
export function MilhasEjaListener() {
  const [popup, setPopup] = useState<{ pontos: number; msg: string } | null>(null);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<MilhasGanhouEvent>).detail;
      if (!d) return;
      const msg = MENSAGENS_POPUP[d.tipo] ?? "Continue assim!";
      setPopup({ pontos: d.pontos, msg });
      window.setTimeout(() => setPopup(null), 3000);
      if (d.subiuNivel) setLevelUp(d.novoNivel);
    };
    window.addEventListener("milhas:ganhou", handler);
    return () => window.removeEventListener("milhas:ganhou", handler);
  }, []);

  return (
    <>
      {popup && (
        <div className="fixed bottom-6 right-6 z-50 animate-scale-in">
          <div className="bg-gray-900/95 text-white rounded-xl shadow-2xl px-5 py-4 flex items-center gap-3 border border-yellow-400/40">
            <Sparkles className="h-7 w-7 text-yellow-300 animate-pulse" />
            <div>
              <div className="font-bold text-lg">+{popup.pontos} pts</div>
              <div className="text-xs opacity-90">{popup.msg}</div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!levelUp} onOpenChange={(v) => !v && setLevelUp(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Subiu de nível</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-6xl animate-bounce">🎉</div>
            <div className="flex justify-center">
              <Trophy className="h-12 w-12 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold">Parabéns!</h2>
            <p className="text-gray-700">
              Você subiu para <span className="font-bold">{levelUp}</span>! 🎉
            </p>
            <Button onClick={() => setLevelUp(null)} className="w-full">
              Continuar estudando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
