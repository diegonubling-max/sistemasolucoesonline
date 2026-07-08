import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, ArrowRight, ArrowLeft, CheckCircle2, GraduationCap, MessageSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  alunoId: string;
  agendamentoId: string;
  materias: string[];
  whatsapp?: string;
  onSair?: () => void;
}

type MateriaStatus = "nao_iniciada" | "em_andamento" | "concluida";

export function ProvaFluxo({ alunoId, agendamentoId, materias, whatsapp, onSair }: Props) {
  const qc = useQueryClient();
  const [materiaAtiva, setMateriaAtiva] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(4 * 60 * 60);

  // Heartbeat a cada 60s
  useEffect(() => {
    if (!agendamentoId) return;
    const send = () => {
      supabase
        .from("prova_agendamentos")
        .update({ ultimo_heartbeat: new Date().toISOString() })
        .eq("id", agendamentoId)
        .then(() => {});
    };
    send();
    const iv = setInterval(send, 60_000);
    return () => clearInterval(iv);
  }, [agendamentoId]);

  // Cronômetro
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: resultados, refetch: refetchResultados } = useQuery({
    queryKey: ["prova-resultados-agendamento", agendamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_resultados")
        .select("materia, total_acertos, total_questoes, percentual, aprovado, respostas, finalizado_em")
        .eq("agendamento_id", agendamentoId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agendamentoId,
    refetchInterval: 15_000,
  });

  const statusPorMateria = useMemo(() => {
    const m = new Map<string, { status: MateriaStatus; respostas: Record<string, string> }>();
    materias.forEach(mat => m.set(mat, { status: "nao_iniciada", respostas: {} }));
    (resultados ?? []).forEach((r: any) => {
      const resp = (r.respostas ?? {}) as Record<string, string>;
      m.set(r.materia, {
        status: r.finalizado_em ? "concluida" : (Object.keys(resp).length > 0 ? "em_andamento" : "nao_iniciada"),
        respostas: resp,
      });
    });
    return m;
  }, [resultados, materias]);

  const todasConcluidas = materias.every(mat => statusPorMateria.get(mat)?.status === "concluida");

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Se todas concluídas → resultado final
  if (todasConcluidas && (resultados?.length ?? 0) > 0) {
    return <ResultadoFinal resultados={resultados!} materias={materias} whatsapp={whatsapp} onSair={onSair} />;
  }

  // Prova de uma matéria
  if (materiaAtiva) {
    return (
      <MateriaProva
        alunoId={alunoId}
        agendamentoId={agendamentoId}
        materia={materiaAtiva}
        respostasIniciais={statusPorMateria.get(materiaAtiva)?.respostas ?? {}}
        timeLeft={timeLeft}
        formatTime={formatTime}
        onConcluir={async () => {
          await refetchResultados();
          qc.invalidateQueries({ queryKey: ["prova-resultados-agendamento", agendamentoId] });
          setMateriaAtiva(null);
          window.scrollTo(0, 0);
        }}
        onVoltar={() => setMateriaAtiva(null)}
      />
    );
  }

  // Lista de matérias
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-primary">Escolha a matéria</h2>
          <p className="text-sm text-muted-foreground">Você pode responder na ordem que preferir. Cada resposta é salva automaticamente.</p>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold",
          timeLeft < 600 ? "bg-red-100 text-red-600 animate-pulse" : "bg-primary/10 text-primary"
        )}>
          <Clock className="h-5 w-5" /> {formatTime(timeLeft)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {materias.map(mat => {
          const st = statusPorMateria.get(mat)?.status ?? "nao_iniciada";
          const isDone = st === "concluida";
          const isProg = st === "em_andamento";
          return (
            <button
              key={mat}
              disabled={isDone}
              onClick={() => setMateriaAtiva(mat)}
              className={cn(
                "relative p-4 rounded-xl border-2 h-32 flex flex-col items-center justify-center gap-2 transition-all",
                isDone && "border-gray-200 bg-gray-100 opacity-70 cursor-not-allowed",
                isProg && "border-amber-400 bg-amber-50 ring-2 ring-amber-300",
                st === "nao_iniciada" && "border-gray-200 hover:border-primary/60 hover:bg-primary/5"
              )}
            >
              {isDone && <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-green-600" />}
              {isProg && <span className="absolute top-2 right-2 text-lg">🔄</span>}
              <GraduationCap className={cn("h-8 w-8", isDone ? "text-gray-400" : "text-primary")} />
              <span className="font-bold text-sm text-center">{mat}</span>
              <span className="text-[10px] uppercase text-muted-foreground">
                {isDone ? "Concluída" : isProg ? "Em andamento" : "Não iniciada"}
              </span>
            </button>
          );
        })}
      </div>

      {onSair && (
        <div className="text-center">
          <Button variant="ghost" onClick={onSair}>Sair</Button>
        </div>
      )}
    </div>
  );
}

function MateriaProva({
  alunoId, agendamentoId, materia, respostasIniciais, timeLeft, formatTime, onConcluir, onVoltar,
}: {
  alunoId: string; agendamentoId: string; materia: string;
  respostasIniciais: Record<string, string>;
  timeLeft: number; formatTime: (s: number) => string;
  onConcluir: () => void; onVoltar: () => void;
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>(respostasIniciais);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const { data: questoes, isLoading } = useQuery({
    queryKey: ["prova-questoes", materia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_questoes")
        .select("*")
        .eq("materia", materia)
        .eq("ativo", true)
        .order("numero", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const questao = questoes?.[idx];
  const total = questoes?.length ?? 0;

  const handleResponder = async (opt: string) => {
    if (!questao || saving) return;
    setRespostas(prev => ({ ...prev, [questao.id]: opt }));
    setSaving(true);
    const { error } = await supabase.rpc("salvar_resposta_prova", {
      p_aluno_id: alunoId,
      p_agendamento_id: agendamentoId,
      p_materia: materia,
      p_questao_id: questao.id,
      p_resposta: opt,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar resposta", { description: error.message });
    }
  };

  const handleAvancar = async () => {
    if (idx < total - 1) {
      setIdx(i => i + 1);
      window.scrollTo(0, 0);
      return;
    }
    // Última questão → finalizar matéria
    setFinalizing(true);
    const { error } = await supabase.rpc("finalizar_materia_prova", {
      p_aluno_id: alunoId,
      p_agendamento_id: agendamentoId,
      p_materia: materia,
    });
    setFinalizing(false);
    if (error) {
      toast.error("Erro ao finalizar matéria", { description: error.message });
      return;
    }
    toast.success(`${materia} concluída!`);
    onConcluir();
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div>;
  if (!questao) return <div className="p-10 text-center">Sem questões para esta matéria.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="sticky top-2 z-10 bg-white border p-4 rounded-xl shadow flex justify-between items-center gap-4">
        <div>
          <button onClick={onVoltar} className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Voltar às matérias
          </button>
          <h2 className="text-lg font-bold text-primary">{materia}</h2>
          <p className="text-xs text-muted-foreground">Questão {idx + 1} de {total}</p>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-base font-bold",
          timeLeft < 600 ? "bg-red-100 text-red-600 animate-pulse" : "bg-primary/10 text-primary"
        )}>
          <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
        </div>
      </div>

      <Card className="border-l-4 border-l-primary">
        <CardHeader className="bg-muted/30">
          <CardTitle>Questão {questao.numero ?? idx + 1}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <p className="whitespace-pre-wrap leading-relaxed">{questao.enunciado}</p>
          <div className="space-y-2">
            {["a", "b", "c", "d"].map(opt => {
              const label = (questao as any)[`opcao_${opt}`];
              if (!label) return null;
              const sel = respostas[questao.id] === opt;
              return (
                <button
                  key={opt}
                  disabled={saving}
                  onClick={() => handleResponder(opt)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border-2 flex items-center gap-3 transition",
                    sel ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/40",
                    saving && "opacity-70"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold shrink-0",
                    sel ? "bg-primary border-primary text-white" : "border-gray-300 text-gray-400"
                  )}>
                    {opt.toUpperCase()}
                  </div>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(i => Math.max(0, i - 1))}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
        </Button>
        <Button
          className="h-12 px-8 font-bold"
          disabled={!respostas[questao.id] || finalizing}
          onClick={handleAvancar}
        >
          {finalizing && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
          {idx === total - 1 ? "Concluir matéria" : "Próxima"}
          {!finalizing && idx < total - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ResultadoFinal({
  resultados, materias, whatsapp, onSair,
}: {
  resultados: any[]; materias: string[]; whatsapp?: string; onSair?: () => void;
}) {
  const totalAprovados = resultados.filter(r => r.aprovado).length;
  const aprovadoGeral = totalAprovados === materias.length;
  const reprovadas = resultados.filter(r => !r.aprovado).map(r => r.materia);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Resultado da Prova Final</h2>
        <p className={cn("text-2xl font-extrabold", aprovadoGeral ? "text-green-600" : "text-red-600")}>
          {aprovadoGeral ? "✅ APROVADO" : "❌ REPROVADO"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {materias.map(m => {
          const r = resultados.find(x => x.materia === m);
          const ok = r?.aprovado;
          return (
            <Card key={m} className={cn("overflow-hidden", ok ? "border-green-200" : "border-red-200")}>
              <div className={cn("px-4 py-2 text-xs font-bold uppercase text-white", ok ? "bg-green-500" : "bg-red-500")}>
                {ok ? "Aprovado" : "Reprovado"}
              </div>
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg">{m}</h4>
                  <p className="text-sm text-muted-foreground">
                    {r?.total_acertos ?? 0}/{r?.total_questoes ?? 10} acertos ({Number(r?.percentual ?? 0).toFixed(1)}%)
                  </p>
                </div>
                {ok ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <AlertTriangle className="h-8 w-8 text-red-500" />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reprovadas.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-6 text-center space-y-4">
            <p className="text-red-700">Você precisa refazer: {reprovadas.join(", ")}.</p>
            <Button className="bg-green-600 h-12 px-8" onClick={() => window.open(`https://wa.me/${whatsapp || "5551990010689"}`, "_blank")}>
              <MessageSquare className="mr-2 h-5 w-5" /> Falar com secretaria
            </Button>
          </CardContent>
        </Card>
      )}

      {onSair && (
        <div className="text-center">
          <Button variant="outline" onClick={onSair}>Sair</Button>
        </div>
      )}
    </div>
  );
}
