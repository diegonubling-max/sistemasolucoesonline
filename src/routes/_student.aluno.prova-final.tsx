import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Lock, MessageSquare, CheckCircle2, AlertTriangle, GraduationCap, Loader2 } from "lucide-react";
import { format, isAfter, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student/aluno/prova-final")({
  component: ProvaFinalPage,
});

function ProvaFinalPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(false);

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
        .in("status", ["agendado", "iniciado"])
        .order("data_prova", { ascending: true })
        .order("hora_prova", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!aluno?.id,
  });

  const { data: resultados } = useQuery({
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
      navigate({ to: "/aluno/prova-final/execucao" });
    },
  });

  if (loadingAgendamento) return <div className="p-8 text-center">Carregando...</div>;

  // Se tiver resultados e todos aprovados
  const materias = ["Geografia", "História", "Filosofia", "Sociologia", "Português", "Inglês", "Biologia", "Química", "Física", "Matemática"];
  const resultadosRecentes = resultados?.filter(r => r.agendamento_id === resultados[0]?.agendamento_id);
  const aprovadoEmTudo = resultadosRecentes && resultsAllPassed(resultadosRecentes, materias);

  if (aprovadoEmTudo) {
    return <TelaFormatura width={width} height={height} />;
  }

  // Se já fez a prova mas reprovou em algo
  if (resultadosRecentes && resultadosRecentes.length > 0 && !agendamento) {
    return <TelaResultados resultados={resultadosRecentes} materias={materias} />;
  }

  if (!agendamento) {
    return (
      <Card className="max-w-2xl mx-auto border-2 border-dashed border-gray-200">
        <CardContent className="py-12 text-center space-y-6">
          <Calendar className="h-16 w-16 mx-auto text-gray-400" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Nenhuma Prova Agendada</h2>
            <p className="text-muted-foreground">
              Você ainda não tem um horário agendado para sua Prova Final.
              Entre em contato com a secretaria para agendar.
            </p>
          </div>
          <Button 
            className="bg-green-600 hover:bg-green-700 h-12 px-8"
            onClick={() => window.open("https://wa.me/5551990010689", "_blank")}
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Agendar via WhatsApp (51) 99001-0689
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Verificar se já chegou a hora
  const dataHoraStr = `${agendamento.data_prova}T${agendamento.hora_prova}`;
  const dataHoraProva = parseISO(dataHoraStr);
  const agora = new Date();
  const podeComecar = isAfter(agora, dataHoraProva);

  return (
    <Card className="max-w-2xl mx-auto overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
        <CardTitle className="text-3xl font-bold">Sua Prova Final</CardTitle>
        <CardDescription className="text-primary-foreground/80 text-lg">
          {podeComecar ? "Tudo pronto para começar!" : "Seu agendamento está confirmado."}
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
              <p className="text-sm text-yellow-700">
                A prova será liberada automaticamente no dia e horário agendados. 
                Prepare-se bem e boa sorte!
              </p>
            </div>
          </div>
        )}

        {podeComecar && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl space-y-4">
              <h4 className="font-bold text-blue-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Instruções Importantes
              </h4>
              <ul className="text-sm text-blue-700 space-y-2 list-disc pl-5">
                <li>Você terá <strong>4 horas</strong> para concluir as 100 questões.</li>
                <li>As matérias seguem uma ordem fixa e você não poderá voltar para a anterior.</li>
                <li>Certifique-se de estar em um ambiente calmo e com boa conexão.</li>
                <li>Ao clicar em começar, o cronômetro será iniciado.</li>
              </ul>
            </div>
            <Button 
              className="w-full h-14 text-lg font-bold"
              onClick={() => startProva.mutate()}
              disabled={startProva.isPending}
            >
              {startProva.isPending ? <Loader2 className="animate-spin mr-2" /> : <PlayIcon className="mr-2" />}
              Começar Prova Agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlayIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
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
      <div className="animate-bounce">
        <GraduationCap className="h-32 w-32 mx-auto text-primary" />
      </div>
      <div className="space-y-4">
        <h1 className="text-5xl font-extrabold text-primary">PARABÉNS!</h1>
        <h2 className="text-3xl font-bold">Você concluiu sua Prova Final com sucesso!</h2>
        <p className="text-xl text-muted-foreground max-w-xl mx-auto">
          Você foi aprovado em todas as matérias e agora é oficialmente um formando da Soluções Online.
        </p>
      </div>

      <div className="pt-8">
        <Button 
          className="bg-green-600 hover:bg-green-700 h-16 px-10 text-xl font-bold rounded-2xl shadow-xl hover:scale-105 transition-transform"
          onClick={() => window.open("https://wa.me/5551990010689", "_blank")}
        >
          <MessageSquare className="mr-3 h-6 w-6" />
          Solicitar Certificado via WhatsApp
        </Button>
      </div>
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
        <p className="text-muted-foreground">Confira seu desempenho por matéria</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {materias.map(m => {
          const res = resultados.find(r => r.materia === m);
          return (
            <Card key={m} className={cn("overflow-hidden", res?.aprovado ? "border-green-200" : "border-red-200")}>
              <div className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider", res?.aprovado ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                {res?.aprovado ? "Aprovado" : "Reprovado"}
              </div>
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg">{m}</h4>
                  <p className="text-sm text-muted-foreground">{res?.total_acertos || 0}/10 acertos ({res?.percentual || 0}%)</p>
                </div>
                {res?.aprovado ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-red-50 border-red-200">
        <CardContent className="py-8 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-red-800">Não foi dessa vez...</h3>
            <p className="text-red-700">
              Você ainda precisa ser aprovado em: <span className="font-bold">{reprovadas.join(", ")}</span>.
              Não se preocupe, você pode estudar mais um pouco e agendar uma nova tentativa.
            </p>
          </div>
          <Button 
            className="bg-green-600 hover:bg-green-700 h-12 px-8"
            onClick={() => window.open("https://wa.me/5551990010689", "_blank")}
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Reagendar via WhatsApp (51) 99001-0689
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
