import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Lock, MessageSquare, CheckCircle2, AlertTriangle, GraduationCap, Loader2, ArrowRight } from "lucide-react";
import { format, isAfter, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student/aluno/prova-final")({
  component: ProvaFinalPage,
});

const MATERIAS = [
  "Geografia", "História", "Filosofia", "Sociologia", "Português", 
  "Inglês", "Biologia", "Química", "Física", "Matemática"
];

function ProvaFinalPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  
  // Estados da Prova
  const [etapa, setEtapa] = useState<'instrucoes' | 'realizando' | 'resultado'>('instrucoes');
  const [currentMateriaIndex, setCurrentMateriaIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({}); 
  const [timeLeft, setTimeLeft] = useState(4 * 60 * 60);
  const [isFinishing, setIsFinishing] = useState(false);

  const materiaAtual = MATERIAS[currentMateriaIndex];

  // Queries
  const { data: aluno } = useQuery({
    queryKey: ["student-data-prova", session?.user.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, ctr, data_liberacao_prova")
        .eq("email", session?.user.email ?? "")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.email,
  });

  const { data: agendamento, isLoading: loadingAgendamento, refetch: refetchAgendamento } = useQuery({
    queryKey: ["current-prova-agendamento", aluno?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_agendamentos")
        .select("*")
        .eq("aluno_id", aluno!.id)
        .in("status", ["agendado", "iniciado", "concluido"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!aluno?.id,
  });

  const { data: resultados, refetch: refetchResultados } = useQuery({
    queryKey: ["prova-resultados-aluno", aluno?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_resultados")
        .select("*")
        .eq("aluno_id", aluno!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!aluno?.id,
  });

  const { data: questoes, isLoading: loadingQuestoes } = useQuery({
    queryKey: ["questoes-materia-local", materiaAtual],
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
    enabled: etapa === 'realizando' && !!materiaAtual,
  });

  // Temporizador
  useEffect(() => {
    if (etapa !== 'realizando') return;
    if (timeLeft <= 0) {
      handleFinalizarProva();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [etapa, timeLeft]);

  const startProva = useMutation({
    mutationFn: async () => {
      if (!agendamento) return;
      const { error } = await supabase
        .from("prova_agendamentos")
        .update({ status: "iniciado" })
        .eq("id", agendamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEtapa('realizando');
    },
    onError: (error) => {
      console.error("Erro na mutation startProva:", error);
      toast.error("Erro ao iniciar a prova. Tente novamente.");
    }
  });

  const handleResponder = (questaoId: string, opcao: string) => {
    setRespostas(prev => ({ ...prev, [questaoId]: opcao }));
  };

  const handleProximaMateria = async () => {
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

        const percentual = (acertos / (questoesMateria.length || 1)) * 100;
        return {
          aluno_id: aluno.id,
          agendamento_id: agendamento.id,
          materia,
          total_acertos: acertos,
          percentual,
          aprovado: percentual >= 60,
          respostas: respostas
        };
      });

      const { error: errRes } = await supabase.from("prova_resultados").insert(resultadosParaInserir);
      if (errRes) throw errRes;

      await supabase
        .from("prova_agendamentos")
        .update({ status: "concluido" })
        .eq("id", agendamento.id);

      toast.success("Prova finalizada com sucesso!");
      await refetchAgendamento();
      await refetchResultados();
      setEtapa('resultado');
    } catch (e: any) {
      toast.error("Erro ao finalizar prova", { description: e.message });
      setIsFinishing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loadingAgendamento) return <div className="p-8 text-center">Carregando...</div>;

  // Tela de Resultado (quando agendamento está concluído ou etapa é resultado)
  const resultadosRecentes = resultados?.filter(r => r.agendamento_id === agendamento?.id);
  const aprovadoEmTudo = resultadosRecentes && resultsAllPassed(resultadosRecentes, MATERIAS);

  if (aprovadoEmTudo || (agendamento?.status === 'concluido' && etapa === 'instrucoes')) {
    if (aprovadoEmTudo) return <TelaFormatura width={width} height={height} />;
    if (resultadosRecentes && resultadosRecentes.length > 0) return <TelaResultados resultados={resultadosRecentes} materias={MATERIAS} />;
  }

  // Renderização condicional por Etapa
  if (etapa === 'realizando') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <div className="sticky top-20 z-10 bg-white border-b p-4 rounded-xl shadow-md flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-primary">{materiaAtual}</h2>
            <p className="text-sm text-muted-foreground">Matéria {currentMateriaIndex + 1} de {MATERIAS.length}</p>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold",
            timeLeft < 600 ? "bg-red-100 text-red-600 animate-pulse" : "bg-primary/10 text-primary"
          )}>
            <Clock className="h-6 w-6" />
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="space-y-8">
          {loadingQuestoes ? (
            <div className="py-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
          ) : (
            questoes?.map((q, idx) => (
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
                            "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group",
                            isSelected ? "border-primary bg-primary/5 shadow-inner" : "border-gray-100 hover:border-primary/50 hover:bg-gray-50"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold shrink-0 transition-colors",
                            isSelected ? "bg-primary border-primary text-white" : "border-gray-200 text-gray-400 group-hover:border-primary/50"
                          )}>
                            {opt.toUpperCase()}
                          </div>
                          <span className={cn("flex-1", isSelected ? "font-medium" : "text-gray-700")}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-end pt-8">
          <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-xl" onClick={handleProximaMateria} disabled={isFinishing}>
            {isFinishing ? <Loader2 className="animate-spin mr-2" /> : currentMateriaIndex === MATERIAS.length - 1 ? <CheckCircle2 className="mr-2" /> : <ArrowRight className="ml-2" />}
            {currentMateriaIndex === MATERIAS.length - 1 ? "Finalizar Prova" : "Próxima Matéria"}
          </Button>
        </div>
      </div>
    );
  }

  if (etapa === 'resultado' && resultadosRecentes) {
    return <TelaResultados resultados={resultadosRecentes} materias={MATERIAS} />;
  }

  // Etapa Instruções
  if (!agendamento) {
    return (
      <Card className="max-w-2xl mx-auto border-2 border-dashed border-gray-200">
        <CardContent className="py-12 text-center space-y-6">
          <Calendar className="h-16 w-16 mx-auto text-gray-400" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Prova Final</h2>
            <p className="text-muted-foreground">Sua Prova Final está disponível para agendamento!</p>
          </div>
          <Button className="bg-green-600 hover:bg-green-700 h-12 px-8" onClick={() => window.open("https://wa.me/5551990010689", "_blank")}>
            <MessageSquare className="mr-2 h-5 w-5" /> Agendar via WhatsApp (51) 99001-0689
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dataHoraStr = `${agendamento.data_prova}T${agendamento.hora_prova}`;
  const dataHoraProva = parseISO(dataHoraStr);
  const agora = new Date();
  const podeComecar = isAfter(agora, dataHoraProva);

  return (
    <Card className="max-w-2xl mx-auto overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
        <CardTitle className="text-3xl font-bold">Prova Final</CardTitle>
        <CardDescription className="text-primary-foreground/80 text-lg">
          {(() => {
            const dataHoraStr = `${agendamento.data_prova}T${agendamento.hora_prova}`;
            const dataHoraProva = parseISO(dataHoraStr);
            const agora = new Date();
            const hoje = format(agora, 'yyyy-MM-dd');
            const dataProva = agendamento.data_prova;
            
            if (isAfter(agora, dataHoraProva)) {
              return "🎯 Sua Prova Final está liberada! Clique para começar agora!";
            }
            
            if (hoje === dataProva) {
              return `Sua prova é HOJE às ${agendamento.hora_prova.substring(0, 5)}! Prepare-se, você consegue! 💪`;
            }
            
            const diffTime = dataHoraProva.getTime() - agora.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return `Sua Prova Final está agendada! Faltam ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} — ${format(parseISO(dataProva), 'dd/MM/yyyy')} às ${agendamento.hora_prova.substring(0, 5)}. Continue estudando! 📚`;
          })()}
        </CardDescription>
      </CardHeader>
      <CardContent className="py-8 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-muted flex flex-col items-center text-center space-y-2">
            <Calendar className="h-8 w-8 text-primary" />
            <span className="text-sm text-muted-foreground">Data</span>
            <span className="font-bold text-lg">{format(parseISO(agendamento.data_prova), 'dd/MM/yyyy')}</span>
          </div>
          <div className="p-4 rounded-xl bg-muted flex flex-col items-center text-center space-y-2">
            <Clock className="h-8 w-8 text-primary" />
            <span className="text-sm text-muted-foreground">Horário</span>
            <span className="font-bold text-lg">{agendamento.hora_prova.substring(0, 5)}</span>
          </div>
        </div>

        {!podeComecar && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl flex items-start gap-4">
            <Lock className="h-6 w-6 text-yellow-600 mt-1" />
            <div className="space-y-1">
              <h4 className="font-bold text-yellow-800">Acesso ainda bloqueado</h4>
              <p className="text-sm text-yellow-700">A prova será liberada automaticamente no dia e horário agendados.</p>
            </div>
          </div>
        )}

        {podeComecar && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl space-y-4">
              <h4 className="font-bold text-blue-800 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Instruções Importantes</h4>
              <ul className="text-sm text-blue-700 space-y-2 list-disc pl-5">
                <li>Você terá <strong>4 horas</strong> para concluir as 10 questões de cada matéria.</li>
                <li>As matérias seguem uma ordem fixa e você não poderá voltar para a anterior.</li>
                <li>Ao clicar em começar, o cronômetro será iniciado.</li>
              </ul>
            </div>
            <button 
              className="w-full h-14 text-lg font-bold bg-[#1E3A5F] text-white rounded-md transition-all hover:bg-[#2D6ADF] flex items-center justify-center relative z-50 cursor-pointer shadow-lg"
              onClick={() => startProva.mutate()}
            >
              Começar Prova Agora
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function resultsAllPassed(resultados: any[], materias: string[]) {
  if (!resultados || resultados.length < materias.length) return false;
  return materias.every(m => {
    const res = resultados.find(r => r.materia === m);
    return res && res.aprovado;
  });
}

function TelaFormatura({ width, height }: any) {
  return (
    <div className="max-w-3xl mx-auto text-center space-y-8 py-12">
      <Confetti width={width} height={height} numberOfPieces={300} recycle={false} />
      <GraduationCap className="h-32 w-32 mx-auto text-primary animate-bounce" />
      <div className="space-y-4">
        <h1 className="text-5xl font-extrabold text-primary">PARABÉNS!</h1>
        <h2 className="text-3xl font-bold">Você concluiu sua Prova Final com sucesso!</h2>
        <p className="text-xl text-muted-foreground">Você foi aprovado em todas as matérias.</p>
      </div>
      <Button className="bg-green-600 hover:bg-green-700 h-16 px-10 text-xl font-bold rounded-2xl" onClick={() => window.open("https://wa.me/5551990010689", "_blank")}>
        <MessageSquare className="mr-3 h-6 w-6" /> Solicitar Certificado via WhatsApp
      </Button>
    </div>
  );
}

function TelaResultados({ resultados, materias }: { resultados: any[], materias: string[] }) {
  const reprovadas = materias.filter(m => {
    const res = resultados.find(r => r.materia === m);
    return !res || !res.aprovado;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Resultado da Prova Final</h2>
        <p className="text-muted-foreground">Confira seu desempenho</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {materias.map(m => {
          const res = resultados.find(r => r.materia === m);
          return (
            <Card key={m} className={cn("overflow-hidden", res?.aprovado ? "border-green-200" : "border-red-200")}>
              <div className={cn("px-4 py-2 text-xs font-bold uppercase text-white", res?.aprovado ? "bg-green-500" : "bg-red-500")}>
                {res?.aprovado ? "Aprovado" : "Reprovado"}
              </div>
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg">{m}</h4>
                  <p className="text-sm text-muted-foreground">{res?.total_acertos || 0}/10 acertos ({res?.percentual || 0}%)</p>
                </div>
                {res?.aprovado ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <AlertTriangle className="h-8 w-8 text-red-500" />}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {reprovadas.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-8 text-center space-y-6">
            <h3 className="text-xl font-bold text-red-800">Não foi dessa vez...</h3>
            <p className="text-red-700">Ainda precisa ser aprovado em: {reprovadas.join(", ")}.</p>
            <Button className="bg-green-600 h-12 px-8" onClick={() => window.open("https://wa.me/5551990010689", "_blank")}>
              <MessageSquare className="mr-2 h-5 w-5" /> Reagendar via WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}