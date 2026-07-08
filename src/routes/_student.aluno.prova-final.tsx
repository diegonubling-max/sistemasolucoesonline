import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Lock, MessageSquare, CheckCircle2, AlertTriangle, GraduationCap, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { format, isAfter, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { cn } from "@/lib/utils";
import { ProvaFluxo } from "@/components/prova/ProvaFluxo";

export const Route = createFileRoute("/_student/aluno/prova-final")({
  component: ProvaFinalPage,
});

const MATERIAS_BASE = [
  "Geografia", "História", "Filosofia", "Sociologia", "Português", 
  "Inglês", "Biologia", "Química", "Física", "Matemática"
];

function ProvaFinalPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  
  // Estados da Prova
  const [etapa, setEtapa] = useState<'instrucoes' | 'escolher_ordem' | 'realizando' | 'resultado'>('instrucoes');
  const [currentMateriaIndex, setCurrentMateriaIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({}); 
  const [timeLeft, setTimeLeft] = useState(4 * 60 * 60);
  const [isFinishing, setIsFinishing] = useState(false);
  const [ordemSelecionada, setOrdemSelecionada] = useState<string[]>([]);
  const [showPopup, setShowPopup] = useState(true);

  // Queries
  const { data: aluno } = useQuery({
    queryKey: ["student-data-prova", session?.user.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, ctr, data_liberacao_prova, materias_prova, polos(whatsapp)")
        .eq("email", session?.user.email ?? "")
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!session?.user.email,
  });

  const materiasDisponiveis = aluno?.materias_prova && aluno.materias_prova.length > 0 
    ? aluno.materias_prova 
    : MATERIAS_BASE;

  const materiasParaRealizar = ordemSelecionada.length > 0 ? ordemSelecionada : materiasDisponiveis;
  const materiaAtual = materiasParaRealizar[currentMateriaIndex];

  useEffect(() => {
    console.log("[ProvaFinal] Auth user:", { user_id: session?.user.id, email: session?.user.email });
  }, [session?.user.id, session?.user.email]);

  useEffect(() => {
    if (aluno) console.log("[ProvaFinal] aluno encontrado em public.alunos:", { aluno_id: aluno.id, ctr: aluno.ctr });
  }, [aluno]);

  const { data: agendamento, isLoading: loadingAgendamento, refetch: refetchAgendamento } = useQuery({
    queryKey: ["current-prova-agendamento", session?.user.email],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[ProvaFinal] Auth user:", { user_id: user?.id, email: user?.email });

      if (!user?.email) throw new Error("Usuário logado não encontrado");

      const { data: alunoAgendamento, error: alunoError } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user.email)
        .single();

      console.log("[ProvaFinal] aluno_id encontrado na tabela alunos:", { aluno_id: alunoAgendamento?.id, error: alunoError });
      if (alunoError) throw alunoError;

      const hojeStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("prova_agendamentos")
        .select("*")
        .eq("aluno_id", alunoAgendamento.id)
        .eq("status", "agendada")
        .eq("data_prova", hojeStr)
        .maybeSingle();

      console.log("[ProvaFinal] resultado da query de agendamentos:", { aluno_id: alunoAgendamento.id, data, error });
      if (error?.code === "PGRST116") return null;
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.email,
  });



  // Removido auto-redirecionamento para garantir que o aluno sempre veja as instruções
  // conforme solicitado: "Nunca pular a tela de orientação independente de como o aluno chegou na prova"

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

    if (currentMateriaIndex < materiasParaRealizar.length - 1) {
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

      const resultadosParaInserir = materiasParaRealizar.map((materia: string) => {
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

  // Se já iniciou/concluiu prova, ou o aluno clicou em começar → fluxo interativo
  const resultadosRecentes = resultados?.filter(r => r.agendamento_id === agendamento?.id);
  const aprovadoEmTudo = resultadosRecentes && resultsAllPassed(resultadosRecentes, materiasDisponiveis);

  if (aprovadoEmTudo) {
    return <TelaFormatura width={width} height={height} whatsapp={aluno?.polos?.whatsapp} />;
  }

  if (etapa === 'realizando' || agendamento?.status === 'iniciado' || agendamento?.status === 'concluido') {
    if (!aluno?.id || !agendamento?.id) {
      return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div>;
    }
    return (
      <ProvaFluxo
        alunoId={aluno.id}
        agendamentoId={agendamento.id}
        materias={materiasDisponiveis}
        whatsapp={aluno?.polos?.whatsapp}
      />
    );
  }


  const whatsappNumero = aluno?.polos?.whatsapp || "5551990010689";

  // ESTADO 1 — Prova ainda não liberada (hoje < data_liberacao_prova)
  if (aluno?.data_liberacao_prova && !agendamento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataLiberacao = parseISO(aluno.data_liberacao_prova);
    dataLiberacao.setHours(0, 0, 0, 0);

    if (hoje.getTime() < dataLiberacao.getTime()) {
      const diffMs = dataLiberacao.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const dataLibFmt = format(dataLiberacao, 'dd/MM/yyyy');

      return (
        <Card className="max-w-2xl mx-auto overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
            <div className="flex justify-center mb-4">
              <Lock className="h-20 w-20" />
            </div>
            <CardTitle className="text-3xl font-bold">
              Sua prova ainda não está liberada
            </CardTitle>
          </CardHeader>
          <CardContent className="py-8 space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {diffDays === 1 ? 'Falta 1 dia' : `Faltam ${diffDays} dias`} para você poder agendar
              </p>
              <p className="text-lg text-muted-foreground">
                Data de liberação: <strong>{dataLibFmt}</strong>
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3 text-left">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-700">
                Continue assistindo às aulas e se preparando. Em breve você poderá agendar sua Prova Final.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  // ESTADO 2 — Liberada mas sem agendamento: popup para agendar via WhatsApp
  if (!agendamento) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Dialog open={showPopup} onOpenChange={setShowPopup}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Prova Final 🎓
              </DialogTitle>
              <DialogDescription className="text-gray-700 pt-2 text-center">
                Sua Prova Final está disponível para agendamento! Clique no botão abaixo para falar com nosso setor de provas e marcar seu exame.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-center py-6">
              <Calendar className="h-16 w-16 text-gray-400" />
            </div>

            <DialogFooter>
              <Button
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none gap-2 py-6 text-lg"
                onClick={() => window.open(`https://wa.me/${whatsappNumero}?text=${encodeURIComponent("Olá! Gostaria de agendar minha Prova Final.")}`, "_blank")}
              >
                <MessageSquare className="h-5 w-5" />
                Agendar via WhatsApp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Calendar className="h-16 w-16 text-gray-200 mb-4" />
        <h2 className="text-xl font-medium text-gray-400">Aguardando agendamento...</h2>
      </div>
    );
  }

  // Combina data + hora em um único datetime e compara com agora
  const dataHoraStr = `${agendamento.data_prova}T${agendamento.hora_prova}`;
  const dataHoraProva = parseISO(dataHoraStr);
  const agora = new Date();
  const podeComecar = agora.getTime() >= dataHoraProva.getTime();

  console.log("Debug Prova Final:", {
    agendamentoId: agendamento?.id,
    status: agendamento?.status,
    data: agendamento?.data_prova,
    hora: agendamento?.hora_prova,
    podeComecar,
    agora: format(agora, 'yyyy-MM-dd HH:mm:ss'),
    dataHoraProva: format(dataHoraProva, 'yyyy-MM-dd HH:mm:ss')
  });

  // CASO 2 — Agendada mas a data/hora ainda não chegou: tela informativa (sem popup)
  if (!podeComecar) {
    const diffMs = dataHoraProva.getTime() - agora.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const dataFmt = format(parseISO(agendamento.data_prova), 'dd/MM/yyyy');
    const horaFmt = agendamento.hora_prova.substring(0, 5);

    return (
      <Card className="max-w-2xl mx-auto overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
          <div className="flex justify-center mb-4">
            <Calendar className="h-20 w-20" />
          </div>
          <CardTitle className="text-3xl font-bold">
            Sua Prova Final está agendada!
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-2xl font-bold">
              Data: {dataFmt} às {horaFmt}
            </p>
            <p className="text-lg text-muted-foreground">
              {diffDays <= 0
                ? `Prepare-se! Sua prova é HOJE.`
                : `Prepare-se! ${diffDays === 1 ? 'Falta 1 dia.' : `Faltam ${diffDays} dias.`}`}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3 text-left">
            <Lock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-700">
              A prova será liberada automaticamente no dia e horário agendados.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 gap-2 border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10"
            onClick={() => window.open(`https://wa.me/${whatsappNumero}?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre minha Prova Final.")}`, "_blank")}
          >
            <MessageSquare className="h-5 w-5" />
            Tirar dúvidas via WhatsApp
          </Button>
        </CardContent>
      </Card>
    );
  }

  // CASO 3 — Chegou o dia e a hora: tela de orientações + "Começar Prova Agora"
  return (
    <Card className="max-w-2xl mx-auto overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
        <CardTitle className="text-3xl font-bold">Sua Prova Final</CardTitle>
        <CardDescription className="text-primary-foreground/80 text-lg">
          Tudo pronto para começar!
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

        <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl space-y-4">
          <h4 className="font-bold text-blue-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Instruções Importantes
          </h4>
          <ul className="text-sm text-blue-700 space-y-2 list-disc pl-5">
            <li>Você terá <strong>4 horas</strong> para concluir as 10 questões de cada matéria.</li>
            <li>Você poderá escolher a ordem das matérias antes de começar.</li>
            <li>As matérias seguem a ordem que você escolher e não poderá voltar.</li>
            <li>Certifique-se de estar em ambiente calmo e com boa conexão.</li>
            <li>Ao clicar em começar, o cronômetro será iniciado.</li>
          </ul>
        </div>

        <Button
          className="w-full h-14 text-lg font-bold bg-[#1E3A5F] hover:bg-[#2D6ADF] shadow-lg rounded-xl"
          onClick={() => setEtapa('escolher_ordem')}
        >
          Começar Prova Agora <ArrowRight className="ml-2 h-6 w-6" />
        </Button>
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

function TelaFormatura({ width, height, whatsapp }: { width: number, height: number, whatsapp?: string }) {
  return (
    <div className="max-w-3xl mx-auto text-center space-y-8 py-12">
      <Confetti width={width} height={height} numberOfPieces={300} recycle={false} />
      <GraduationCap className="h-32 w-32 mx-auto text-primary animate-bounce" />
      <div className="space-y-4">
        <h1 className="text-5xl font-extrabold text-primary">PARABÉNS!</h1>
        <h2 className="text-3xl font-bold">Você concluiu sua Prova Final com sucesso!</h2>
        <p className="text-xl text-muted-foreground">Você foi aprovado em todas as matérias.</p>
      </div>
      <Button className="bg-green-600 hover:bg-green-700 h-16 px-10 text-xl font-bold rounded-2xl" onClick={() => window.open(`https://wa.me/${whatsapp || "5551990010689"}`, "_blank")}>
        <MessageSquare className="mr-3 h-6 w-6" /> Solicitar Certificado via WhatsApp
      </Button>
    </div>
  );
}

function TelaResultados({ resultados, materias, whatsapp }: { resultados: any[], materias: string[], whatsapp?: string }) {
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
            <Button className="bg-green-600 h-12 px-8" onClick={() => window.open(`https://wa.me/${whatsapp || "5551990010689"}`, "_blank")}>
              <MessageSquare className="mr-2 h-5 w-5" /> Reagendar via WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}