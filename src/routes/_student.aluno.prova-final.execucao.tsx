import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student/aluno/prova-final/execucao")({
  component: ProvaExecucaoPage,
});

const MATERIAS = [
  "Geografia", "História", "Filosofia", "Sociologia", "Português", 
  "Inglês", "Biologia", "Química", "Física", "Matemática"
];

function ProvaExecucaoPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  
  const [currentMateriaIndex, setCurrentMateriaIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({}); // { questionId: "a" }
  const [timeLeft, setTimeLeft] = useState(4 * 60 * 60); // 4 horas em segundos
  const [isFinishing, setIsFinishing] = useState(false);

  const materiaAtual = MATERIAS[currentMateriaIndex];

  const { data: aluno } = useQuery({
    queryKey: ["student-data-exec", session?.user.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", session?.user.email ?? "")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.email,
  });

  const { data: agendamento } = useQuery({
    queryKey: ["current-prova-agendamento-exec", aluno?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_agendamentos")
        .select("*")
        .eq("aluno_id", aluno!.id)
        .eq("status", "iniciado")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!aluno?.id,
  });

  const { data: questoes, isLoading: loadingQuestoes } = useQuery({
    queryKey: ["questoes-materia", materiaAtual],
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
    enabled: !!materiaAtual,
  });

  // Temporizador
  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalizarProva();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleResponder = (questaoId: string, opcao: string) => {
    setRespostas(prev => ({ ...prev, [questaoId]: opcao }));
  };

  const handleProximaMateria = async () => {
    // Verificar se todas as questões da matéria atual foram respondidas
    const questaoIdsMateria = questoes?.map(q => q.id) || [];
    const todasRespondidas = questaoIdsMateria.every(id => respostas[id]);
    
    if (!todasRespondidas) {
      if (!confirm("Você ainda não respondeu todas as questões desta matéria. Deseja prosseguir mesmo assim? Você não poderá voltar.")) {
        return;
      }
    }

    if (currentMateriaIndex < MATERIAS.length - 1) {
      setCurrentMateriaIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    } else {
      handleFinalizarProva();
    }
  };

  const handleFinalizarProva = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    
    try {
      if (!aluno || !agendamento) throw new Error("Dados não carregados");

      // Buscar todas as questões da prova para conferir respostas
      const { data: todasQuestoes } = await supabase
        .from("prova_questoes")
        .select("*")
        .eq("ativo", true);
      
      if (!todasQuestoes) throw new Error("Erro ao buscar questões");

      const resultadosParaInserir = MATERIAS.map(materia => {
        const questoesMateria = todasQuestoes.filter(q => q.materia === materia);
        let acertos = 0;
        
        questoesMateria.forEach(q => {
          if (respostas[q.id] === q.resposta_correta?.toLowerCase()) {
            acertos++;
          }
        });

        const percentual = (acertos / questoesMateria.length) * 100;
        return {
          aluno_id: aluno.id,
          agendamento_id: agendamento.id,
          materia,
          total_acertos: acertos,
          percentual,
          aprovado: percentual >= 60,
          respostas: respostas // salvamos o objeto completo em cada linha por simplicidade ou poderiamos filtrar
        };
      });

      const { error: errRes } = await supabase.from("prova_resultados").insert(resultadosParaInserir);
      if (errRes) throw errRes;

      const { error: errAg } = await supabase
        .from("prova_agendamentos")
        .update({ status: "concluido" })
        .eq("id", agendamento.id);
      if (errAg) throw errAg;

      toast.success("Prova finalizada com sucesso!");
      navigate({ to: "/aluno/prova-final" });
    } catch (e: any) {
      toast.error("Erro ao finalizar prova", { description: e.message });
      setIsFinishing(false);
    }
  };

  if (loadingQuestoes) return <div className="p-8 text-center">Carregando questões...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header Fixo com Cronômetro */}
      <div className="sticky top-16 sm:top-20 z-10 bg-white border-b p-3 sm:p-4 rounded-xl shadow-md flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-primary truncate">{materiaAtual}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Matéria {currentMateriaIndex + 1} de {MATERIAS.length}</p>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-mono text-lg sm:text-xl font-bold self-start sm:self-auto",
          timeLeft < 600 ? "bg-red-100 text-red-600 animate-pulse" : "bg-primary/10 text-primary"
        )}>
          <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
          {formatTime(timeLeft)}
        </div>
      </div>


      {/* Lista de Questões */}
      <div className="space-y-8">
        {questoes?.map((q, idx) => (
          <Card key={q.id} className="overflow-hidden border-l-4 border-l-primary">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-lg">Questão {q.numero || idx + 1}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <p className="text-lg leading-relaxed whitespace-pre-wrap">{q.enunciado}</p>
              
              <div className="space-y-3">
                {['a', 'b', 'c', 'd'].map((opt) => {
                  const key = `opcao_${opt}` as keyof typeof q;
                  const label = q[key];
                  if (!label) return null;
                  
                  const isSelected = respostas[q.id] === opt;
                  
                  return (
                    <button
                      key={opt}
                      onClick={() => handleResponder(q.id, opt)}
                      className={cn(
                        "w-full text-left p-4 min-h-[56px] rounded-xl border-2 transition-all flex items-center gap-3 sm:gap-4 group active:scale-[0.99]",
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-inner" 
                          : "border-gray-100 hover:border-primary/50 hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold shrink-0 transition-colors",
                        isSelected ? "bg-primary border-primary text-white" : "border-gray-200 text-gray-400 group-hover:border-primary/50"
                      )}>
                        {opt.toUpperCase()}
                      </div>
                      <span className={cn("flex-1", isSelected ? "font-medium" : "text-gray-700")}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer de Navegação */}
      <div className="flex justify-end pt-8">
        <Button 
          size="lg" 
          className="h-14 px-8 text-lg font-bold rounded-xl"
          onClick={handleProximaMateria}
          disabled={isFinishing}
        >
          {isFinishing ? (
            <Loader2 className="animate-spin mr-2" />
          ) : currentMateriaIndex === MATERIAS.length - 1 ? (
            <CheckCircle2 className="mr-2" />
          ) : (
            <ArrowRight className="ml-2" />
          )}
          {currentMateriaIndex === MATERIAS.length - 1 ? "Finalizar Prova" : "Próxima Matéria"}
        </Button>
      </div>
    </div>
  );
}
