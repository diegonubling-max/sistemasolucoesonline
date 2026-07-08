import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, ArrowRight, CheckCircle2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/externo/prova")({
  component: ExternoProvaPage,
});

const MATERIAS = [
  "Geografia", "História", "Filosofia", "Sociologia", "Português",
  "Inglês", "Biologia", "Química", "Física", "Matemática",
];

function ExternoProvaPage() {
  const navigate = useNavigate();
  const [ctr, setCtr] = useState<string | null>(null);
  const [nome, setNome] = useState<string>("");
  const [etapa, setEtapa] = useState<"inicio" | "realizando" | "concluido">("inicio");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(4 * 60 * 60);
  const [isFinishing, setIsFinishing] = useState(false);
  const [agendamentoId, setAgendamentoId] = useState<string | null>(null);

  useEffect(() => {
    const c = sessionStorage.getItem("externo_ctr");
    const n = sessionStorage.getItem("externo_nome");
    if (!c) {
      navigate({ to: "/aluno/login" });
      return;
    }
    setCtr(c);
    setNome(n ?? "");
  }, [navigate]);

  const materiaAtual = MATERIAS[currentIdx];

  const { data: questoes, isLoading: loadingQuestoes } = useQuery({
    queryKey: ["externo-questoes", materiaAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_questoes")
        .select("*")
        .eq("materia", materiaAtual)
        .eq("ativo", true)
        .order("numero", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: etapa === "realizando" && !!materiaAtual,
  });

  useEffect(() => {
    if (etapa !== "realizando") return;
    if (timeLeft <= 0) { handleFinalizar(); return; }
    const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [etapa, timeLeft]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleIniciar = async () => {
    if (!ctr) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("prova_agendamentos")
      .update({ status: "iniciado" })
      .eq("ctr", ctr)
      .eq("data_prova", hoje)
      .is("resultado", null)
      .select("id")
      .maybeSingle();
    if (error) {
      toast.error("Erro ao iniciar prova", { description: error.message });
      return;
    }
    if (data?.id) setAgendamentoId(data.id);
    setEtapa("realizando");
  };

  const handleProxima = () => {
    const ids = (questoes ?? []).map((q: any) => q.id);
    const todas = ids.every((id: string) => respostas[id]);
    if (!todas && !confirm("Ainda faltam respostas nesta matéria. Prosseguir mesmo assim?")) return;
    if (currentIdx < MATERIAS.length - 1) {
      setCurrentIdx(i => i + 1);
      window.scrollTo(0, 0);
    } else {
      handleFinalizar();
    }
  };

  const handleFinalizar = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      const { data: todas } = await supabase.from("prova_questoes").select("*").eq("ativo", true);
      if (!todas) throw new Error("Erro ao carregar questões");
      const resultados = MATERIAS.map(m => {
        const qs = todas.filter((q: any) => q.materia === m);
        let acertos = 0;
        qs.forEach((q: any) => {
          if (respostas[q.id] === q.resposta_correta?.toLowerCase()) acertos++;
        });
        const perc = (acertos / (qs.length || 1)) * 100;
        return {
          aluno_id: null,
          agendamento_id: agendamentoId,
          materia: m,
          total_acertos: acertos,
          percentual: perc,
          aprovado: perc >= 60,
          respostas,
        };
      });
      const { error } = await supabase.from("prova_resultados").insert(resultados);
      if (error) throw error;
      if (agendamentoId) {
        await supabase.from("prova_agendamentos").update({ status: "concluido" }).eq("id", agendamentoId);
      }
      setEtapa("concluido");
    } catch (e: any) {
      toast.error("Erro ao finalizar", { description: e.message });
      setIsFinishing(false);
    }
  };

  const handleSair = () => {
    sessionStorage.removeItem("externo_ctr");
    sessionStorage.removeItem("externo_id");
    sessionStorage.removeItem("externo_nome");
    navigate({ to: "/aluno/login" });
  };

  if (!ctr) return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div>;

  if (etapa === "inicio") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-4">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Olá, {nome}!</CardTitle>
            <p className="text-muted-foreground">Sua prova está agendada para hoje.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              A prova contém {MATERIAS.length} matérias. Você tem até 4 horas para concluir.
              Uma vez iniciada, o cronômetro começa a contar.
            </div>
            <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={handleIniciar}>
              Iniciar Prova <ArrowRight className="ml-2" />
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleSair}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (etapa === "concluido") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold">Prova finalizada!</h2>
            <p className="text-muted-foreground">A secretaria entrará em contato com o resultado.</p>
            <Button onClick={handleSair} className="w-full">Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6 pb-24">
        <div className="sticky top-2 z-10 bg-white border p-4 rounded-xl shadow flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-primary">{materiaAtual}</h2>
            <p className="text-sm text-muted-foreground">Matéria {currentIdx + 1} de {MATERIAS.length}</p>
          </div>
          <div className={cn("flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold",
            timeLeft < 600 ? "bg-red-100 text-red-600 animate-pulse" : "bg-primary/10 text-primary")}>
            <Clock className="h-5 w-5" /> {formatTime(timeLeft)}
          </div>
        </div>

        {loadingQuestoes ? (
          <div className="text-center py-10"><Loader2 className="animate-spin inline" /></div>
        ) : (
          <div className="space-y-6">
            {(questoes ?? []).map((q: any, idx: number) => (
              <Card key={q.id} className="border-l-4 border-l-primary">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-lg">Questão {q.numero || idx + 1}</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="whitespace-pre-wrap">{q.enunciado}</p>
                  <div className="space-y-2">
                    {["a", "b", "c", "d"].map(opt => {
                      const label = q[`opcao_${opt}`];
                      if (!label) return null;
                      const sel = respostas[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => setRespostas(r => ({ ...r, [q.id]: opt }))}
                          className={cn("w-full text-left p-3 rounded-lg border-2 flex items-center gap-3 transition",
                            sel ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/40")}
                        >
                          <div className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold shrink-0",
                            sel ? "bg-primary border-primary text-white" : "border-gray-300 text-gray-400")}>
                            {opt.toUpperCase()}
                          </div>
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button size="lg" className="h-14 px-8 text-lg font-bold" onClick={handleProxima} disabled={isFinishing}>
            {isFinishing && <Loader2 className="animate-spin mr-2" />}
            {currentIdx === MATERIAS.length - 1 ? "Finalizar Prova" : "Próxima Matéria"}
            {!isFinishing && currentIdx < MATERIAS.length - 1 && <ArrowRight className="ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
